import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createServer } from '../src/server';

describe('Server API Endpoints', () => {
    let app: Express;

    beforeEach(async () => {
        ({ app } = createServer());
        await request(app).post('/tables').send({ name: 'test_users' });
    });

    it('should create a new table', async () => {
        const response = await request(app)
            .post('/tables')
            .send({ name: 'products' });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            success: true,
            message: "Table 'products' created",
        });
    });

    it('should return 409 if a table already exists', async () => {
        await request(app).post('/tables').send({ name: 'products' });
        const response = await request(app)
            .post('/tables')
            .send({ name: 'products' });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe('Table already exists');
    });

    it('should insert a record into a table', async () => {
        const newUser = { id: 1, name: 'Jane Doe' };
        const response = await request(app)
            .post('/tables/test_users/insert')
            .send(newUser);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    it('should retrieve all records from a table', async () => {
        const newUser = { id: 1, name: 'Jane Doe' };
        await request(app).post('/tables/test_users/insert').send(newUser);

        const response = await request(app).get('/tables/test_users/all');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([newUser]);
    });

    it('should find a record in a table', async () => {
        const newUser = { id: 1, name: 'Jane Doe', email: 'jane@example.com' };
        await request(app).post('/tables/test_users/insert').send(newUser);

        const response = await request(app)
            .post('/tables/test_users/find')
            .send({ where: { name: 'Jane Doe' } });

        expect(response.status).toBe(200);
        expect(response.body).toEqual([newUser]);
    });

    it('should update a record in a table', async () => {
        const newUser = { id: 1, name: 'Jane Doe' };
        await request(app).post('/tables/test_users/insert').send(newUser);

        const response = await request(app)
            .put('/tables/test_users/update')
            .send({ where: { id: 1 }, update: { name: 'Jane Smith' } });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const found = await request(app)
            .post('/tables/test_users/find')
            .send({ where: { id: 1 } });
        expect(found.body[0].name).toBe('Jane Smith');
    });

    it('should delete a record from a table', async () => {
        const newUsers = [
            { id: 1, name: 'Jane Doe' },
            { id: 2, name: 'John Smith' },
        ]
        for (const user of newUsers) {
            await request(app).post('/tables/test_users/insert').send(user);
        }

        const response = await request(app)
            .delete('/tables/test_users/delete')
            .send({ where: { id: 1 } });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const found = await request(app).get('/tables/test_users/all');
        expect(found.body).toHaveLength(1);
        expect(found.body[0]).toEqual({ id: 2, name: 'John Smith' });
    });


    it('can get all tables names', async () => {
        await request(app).post('/tables').send({ name: 'products' });
        await request(app).post('/tables').send({ name: 'test_users' });
        const response = await request(app).get('/tables');

        expect(response.status).toBe(200);
        expect(response.body.sort()).toEqual(['test_users', 'products', 'users'].sort());
    });

    it('should only update records matching the where clause', async () => {
        await request(app).post('/tables/test_users/load').send({
            records: [{ id: 1, name: 'Jane Doe' }, { id: 2, name: 'John Smith' }],
        });

        await request(app)
            .put('/tables/test_users/update')
            .send({ where: { id: 1 }, update: { name: 'Jane Smith' } });

        const all = await request(app).get('/tables/test_users/all');
        expect(all.body).toEqual([
            { id: 1, name: 'Jane Smith' },
            { id: 2, name: 'John Smith' },
        ]);
    });

    it('should return 400 for update without where/update objects', async () => {
        const response = await request(app).put('/tables/test_users/update').send({ update: { name: 'x' } });
        expect(response.status).toBe(400);
    });

    it('should return 400 for delete without a where clause instead of wiping the table', async () => {
        await request(app).post('/tables/test_users/insert').send({ id: 1 });

        const empty = await request(app).delete('/tables/test_users/delete').send({});
        expect(empty.status).toBe(400);
        const noBody = await request(app).delete('/tables/test_users/delete');
        expect(noBody.status).toBe(400);

        const all = await request(app).get('/tables/test_users/all');
        expect(all.body).toHaveLength(1);
    });

    it('should return 400 for load without a records array', async () => {
        const response = await request(app).post('/tables/test_users/load').send({});
        expect(response.status).toBe(400);
    });

    it('should return 404 for table names that exist on Object.prototype', async () => {
        for (const name of ['constructor', 'toString', 'hasOwnProperty']) {
            const response = await request(app).get(`/tables/${name}/all`);
            expect(response.status).toBe(404);
        }
    });

    it('should allow creating a table named like an Object.prototype key', async () => {
        const response = await request(app).post('/tables').send({ name: 'constructor' });
        expect(response.status).toBe(201);
        await request(app).post('/tables/constructor/insert').send({ id: 1 });
        const all = await request(app).get('/tables/constructor/all');
        expect(all.body).toEqual([{ id: 1 }]);
    });
});
