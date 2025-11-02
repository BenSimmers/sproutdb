import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

describe('Server API Endpoints', () => {
    // Reset the database state before each test
    beforeEach(async () => {
        // This is a simple way to reset the in-memory DB for tests.
        await request(app).post('/tables').send({ name: 'test_users' });
        await request(app).delete('/tables/test_users/delete').send({}); // Clear the table
        await request(app).post('/reset'); // Custom endpoint to reset DB
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
        await request(app).post('/tables').send({ name: 'products' }); // Create it once
        const response = await request(app)
            .post('/tables')
            .send({ name: 'products' }); // Try to create it again

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
        const newUser = { id: 1, name: 'Jane Doe' };
        await request(app).post('/tables/test_users/insert').send(newUser);

        const response = await request(app)
            .delete('/tables/test_users/delete')
            .send({ where: { id: 1 } });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const found = await request(app).get('/tables/test_users/all');
        expect(found.body).toHaveLength(0);
    });


    it('can get all tables names', async () => {
        await request(app).post('/tables').send({ name: 'products' });
        await request(app).post('/tables').send({ name: 'test_users' });
        const response = await request(app).get('/tables');

        expect(response.status).toBe(200);
        expect(response.body.sort()).toEqual(['test_users', 'products', 'users'].sort());
    });
});
