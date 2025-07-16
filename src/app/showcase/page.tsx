
'use client';
import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function ShowcasePage() {
    useEffect(() => {
        redirect('/showcase/dashboard');
    }, []);

    return null;
}
