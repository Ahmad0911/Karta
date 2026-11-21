import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { after, before, describe, it } from 'node:test'

import { signUp, start, type Harness } from './harness.ts'

let h: Harness
const ENV = { CLOUDINARY_CLOUD_NAME: 'karta-test', CLOUDINARY_API_KEY: '123456', CLOUDINARY_API_SECRET: 'cld-secret-xyz' }
before(async () => { h = await start(ENV) })
after(async () => { await h.close() })

describe('photo uploads', () => {
  it('hands signed upload details to vendors and customers only', async () => {
    assert.equal((await h.client().post('/api/uploads/sign')).status, 401)
    const admin = await h.makeAdmin(); assert.equal((await admin.post('/api/uploads/sign')).status, 403)
    const v = await signUp(h, { role: 'vendor', businessName: 'Photo Shop' })
    const r = await v.c.post('/api/uploads/sign')
    assert.equal(r.status, 200)
    assert.equal(r.body.uploadUrl, 'https://api.cloudinary.com/v1_1/karta-test/image/upload')
    assert.equal(r.body.fields.folder, 'karta/listings')
    const f = r.body.fields
    const expected = createHash('sha1').update(`allowed_formats=${f.allowed_formats}&folder=${f.folder}&timestamp=${f.timestamp}cld-secret-xyz`).digest('hex')
    assert.equal(f.signature, expected)
    assert.ok(!JSON.stringify(r.body).includes('cld-secret-xyz'), 'the API secret never leaves the server')
    const c = await signUp(h); assert.equal((await c.c.post('/api/uploads/sign')).body.fields.folder, 'karta/requests')
  })
  it('listings only accept photos from our own Cloudinary folder', async () => {
    const v = await signUp(h, { role: 'vendor', businessName: 'Photo Shop Two' })
    const id = (await v.c.post('/api/vendor/listings', { name: 'Sofa with photo' })).body.id
    const ok = await v.c.put(`/api/vendor/listings/${id}`, { images: ['https://res.cloudinary.com/karta-test/image/upload/v1/karta/listings/a.jpg'] })
    assert.equal(ok.status, 200)
    for (const url of ['https://evil.example/tracker.png', 'https://res.cloudinary.com/someone-else/image/upload/a.jpg', 'data:image/png;base64,AAAA', 'http://res.cloudinary.com/karta-test/image/upload/a.jpg']) {
      assert.equal((await v.c.put(`/api/vendor/listings/${id}`, { images: [url] })).status, 422, url)
    }
  })
  it('is switched off cleanly when Cloudinary is not configured', async () => {
    const h2 = await start()
    try { const v = await signUp(h2, { role: 'vendor', businessName: 'No Cloud' }); assert.equal((await v.c.post('/api/uploads/sign')).status, 503) } finally { await h2.close() }
  })
})
