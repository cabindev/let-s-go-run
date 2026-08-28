import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * หน้าสาธารณะ: /, /events, /events/[id], /leaderboard, /auth/*
 * ต้องล็อกอิน: /profile, /payment
 * ต้องเป็น ADMIN: /admin
 */
export async function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl

    const user = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    })

    const signInUrl = new URL('/auth/signin', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname + search)

    if (pathname.startsWith('/admin')) {
        if (!user) return NextResponse.redirect(signInUrl)
        if (user.role !== 'ADMIN') return NextResponse.redirect(new URL('/', request.url))
        return NextResponse.next()
    }

    if (!user) return NextResponse.redirect(signInUrl)

    return NextResponse.next()
}

export const config = {
    matcher: ['/admin/:path*', '/profile/:path*', '/payment/:path*'],
}
