import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { AddressInfo } from 'net';
import { createServer, start } from '../src/server';
import { memoryAdapter } from '../src';

const seed = {
    users: [
        { id: 1, name: 'Alice', age: 30, role: 'admin' },
        { id: 2, name: 'Bob', age: 20, role: 'user' },
        { id: 3, name: 'Carol', age: 40, role: 'user' },
    ],
    notes: [{ id: 'a', text: 'string id' }],
};

describe('REST routes', () => {
    let app: Express;

    beforeEach(() => {
        ({ app } = createServer({ seed }));
    });

    it('lists records filtered, sorted and paginated by the query string', async () => {
        const res = await request(app).get('/tables/users?role=user&age[$gte]=20&_sort=-age&_limit=1');
        expect(res.status).toBe(200);
        expect(res.body.map((u: { name: string }) => u.name)).toEqual(['Carol']);
        expect(res.headers['x-total-count']).toBe('2');
    });

    it('supports $in lists, repeated params and _select', async () => {
        const inList = await request(app).get('/tables/users?name[$in]=Alice,Carol&_select=id,name');
        expect(inList.body).toEqual([{ id: 1, name: 'Alice' }, { id: 3, name: 'Carol' }]);

        const repeated = await request(app).get('/tables/users?id=1&id=2');
        expect(repeated.body).toHaveLength(2);
    });

    it('returns 400 for bad query parameters', async () => {
        expect((await request(app).get('/tables/users?_limit=-1')).status).toBe(400);
        expect((await request(app).get('/tables/users?age[$bogus]=1')).status).toBe(400);
        expect((await request(app).get('/tables/users?name[$regex]=(')).status).toBe(400);
    });

    it('gets a record by numeric or string id', async () => {
        expect((await request(app).get('/tables/users/2')).body.name).toBe('Bob');
        expect((await request(app).get('/tables/notes/a')).body.text).toBe('string id');
        expect((await request(app).get('/tables/users/99')).status).toBe(404);
    });

    it('creates records, assigning ids when missing', async () => {
        const created = await request(app).post('/tables/users').send({ name: 'Dan' });
        expect(created.status).toBe(201);
        expect(created.body).toEqual({ name: 'Dan', id: 4 });

        const note = await request(app).post('/tables/notes').send({ text: 'uuid' });
        expect(note.body.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('patches, replaces and deletes by id', async () => {
        const patched = await request(app).patch('/tables/users/1').send({ age: 31 });
        expect(patched.body).toEqual({ id: 1, name: 'Alice', age: 31, role: 'admin' });

        const replaced = await request(app).put('/tables/users/2').send({ id: 999, name: 'Robert' });
        expect(replaced.body).toEqual({ name: 'Robert', id: 2 });

        expect((await request(app).delete('/tables/users/3')).status).toBe(204);
        expect((await request(app).delete('/tables/users/3')).status).toBe(404);
        expect((await request(app).patch('/tables/users/3').send({ age: 1 })).status).toBe(404);
        expect((await request(app).get('/tables/users')).body).toHaveLength(2);
    });

    it('drops tables', async () => {
        expect((await request(app).delete('/tables/notes')).status).toBe(200);
        expect((await request(app).get('/tables')).body).toEqual(['users']);
    });

    it('returns JSON errors for malformed JSON bodies', async () => {
        const res = await request(app).post('/tables/users').set('Content-Type', 'application/json').send('{bad');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('groups metrics by route pattern', async () => {
        await request(app).get('/tables/users/1');
        await request(app).get('/tables/users/2');
        const metrics = await request(app).get('/metrics');
        expect(metrics.body.requests.byEndpoint['GET /tables/:table/:id']).toBe(2);
    });
});

describe('test helpers', () => {
    it('resets to the seed, dropping runtime tables', async () => {
        const { app } = createServer({ seed });
        await request(app).delete('/tables/users/1');
        await request(app).post('/tables').send({ name: 'extra' });

        await request(app).post('/reset');

        expect((await request(app).get('/tables')).body).toEqual(['users', 'notes']);
        expect((await request(app).get('/tables/users')).body).toHaveLength(3);
    });

    it('snapshots and restores state', async () => {
        const { app } = createServer({ seed });
        const saved = (await request(app).get('/snapshot')).body;
        await request(app).delete('/tables/users/1');

        expect((await request(app).post('/restore').send(saved)).status).toBe(200);
        expect((await request(app).get('/tables/users')).body).toHaveLength(3);
        expect((await request(app).post('/restore').send({ users: 'nope' })).status).toBe(400);
    });

    it('exposes the database for direct setup and inspection', () => {
        const { db } = createServer({ seed });
        db.users.insert({ id: 10, name: 'Direct' });
        expect(db.users.count()).toBe(4);
    });

    it('persists changes to storage and prefers saved data over the seed', async () => {
        const storage = memoryAdapter();
        const first = createServer({ seed, storage });
        await request(first.app).post('/tables/users').send({ name: 'Dan' });
        await request(first.app).post('/tables').send({ name: 'extra' });
        expect(storage.data?.users).toHaveLength(4);
        expect(storage.data?.extra).toEqual([]);

        const second = createServer({ seed, storage });
        expect((await request(second.app).get('/tables/users')).body).toHaveLength(4);
    });

    it('streams changes as server-sent events', async () => {
        const server = start(0, seed, { logging: false });
        await new Promise(resolve => server.once('listening', resolve));
        const { port } = server.address() as AddressInfo;
        const base = `http://localhost:${port}`;
        const controller = new AbortController();
        try {
            const events = await fetch(`${base}/tables/users/events`, { signal: controller.signal });
            const reader = events.body!.getReader();

            await fetch(`${base}/tables/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Dan' }),
            });

            const { value } = await reader.read();
            expect(new TextDecoder().decode(value)).toBe('event: insert\ndata: [{"name":"Dan","id":4}]\n\n');
        } finally {
            controller.abort();
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
    });
});

describe('dashboard', () => {
    it('serves the dashboard and its assets, redirecting / and /dashboard to /dashboard/', async () => {
        const { app } = createServer();

        for (const path of ['/', '/dashboard']) {
            const res = await request(app).get(path);
            expect(res.status).toBe(302);
            expect(res.headers.location).toBe('dashboard/');
        }

        const page = await request(app).get('/dashboard/');
        expect(page.status).toBe(200);
        expect(page.headers['content-type']).toMatch(/text\/html/);
        expect(page.text).toContain('<title>SproutDB Dashboard</title>');

        const script = await request(app).get('/dashboard/js/main.js');
        expect(script.status).toBe(200);
        expect(script.headers['content-type']).toMatch(/javascript/);

        const styles = await request(app).get('/dashboard/styles.css');
        expect(styles.headers['content-type']).toMatch(/text\/css/);
    });

    it('can be turned off', async () => {
        const { app } = createServer({ dashboard: false });
        expect((await request(app).get('/dashboard')).status).toBe(404);
    });
});

