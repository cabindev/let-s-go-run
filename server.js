// server.js — custom Express server สำหรับรัน Next.js บน Plesk (Node.js Application ต้องมี entry
// file ที่เรียก .listen() เอง ใช้ port จาก process.env.PORT ที่ Plesk กำหนดให้ผ่าน Passenger)
const express = require('express')
const next = require('next')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const port = process.env.PORT || 3000

app.prepare().then(() => {
    const server = express()

    // เสิร์ฟรูปที่อัปโหลด (event, avatar, ผลวิ่ง VR) เอง กำหนด cache header ให้ชัดเจน
    // แทนที่จะปล่อยให้ตกไปที่ Next handler เฉยๆ — cache ยาวได้เพราะชื่อไฟล์เป็น UUID ไม่ซ้ำ
    server.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), {
        maxAge: dev ? 0 : '30d',
        etag: true,
        lastModified: true,
        setHeaders: (res) => {
            res.set('X-Content-Type-Options', 'nosniff')
        },
    }))

    server.use((req, res) => handle(req, res))

    server.listen(port, (err) => {
        if (err) throw err
        console.log(`> Ready on http://localhost:${port}`)
        console.log(`> Environment: ${dev ? 'development' : 'production'}`)
    })
})
