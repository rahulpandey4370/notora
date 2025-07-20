
'use client';

import AppLayout from '@/components/notora/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle, Wand2, Link as LinkIcon, StickyNote, ArrowUpRight } from 'lucide-react';

export default function AboutPage() {
  const features = [
    {
      icon: <Wand2 className="h-6 w-6 text-primary" />,
      title: 'AI-Powered Productivity',
      description: 'Leverage Genkit and Google\'s Gemini models to polish notes, summarize content, generate titles, and even perform semantic searches on your saved links.',
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      title: 'Gamified Task Management',
      description: 'Organize your life with daily, weekly, and monthly tasks. Earn XP for completions, track your progress with dynamic charts, and stay motivated.',
    },
    {
      icon: <StickyNote className="h-6 w-6 text-yellow-500" />,
      title: 'Dynamic Note-Taking',
      description: 'Capture ideas in two different views: a free-form sticky notes canvas for brainstorming and a formatted, Markdown-enabled view for structured content.',
    },
    {
      icon: <LinkIcon className="h-6 w-6 text-blue-500" />,
      title: 'Intelligent Link Saving',
      description: 'Save any URL and let AI automatically analyze it, providing a title, summary, and category. Find links later with an intuitive, AI-powered semantic search.',
    },
  ];

  return (
    <AppLayout>
      <main className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="dark:neon-border">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <img src="https://placehold.co/80x80/FFDA63/000000.png?text=N" alt="Notora Logo" data-ai-hint="logo initial" className="rounded-lg" />
              </div>
              <CardTitle className="text-4xl font-headline">About Notora</CardTitle>
              <CardDescription className="text-lg">
                Your magical, AI-powered productivity assistant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                Notora is a comprehensive productivity application designed to seamlessly integrate task management,
                note-taking, and information organization. Built with a modern tech stack, it demonstrates the power of
                combining a polished user interface with cutting-edge generative AI to create a truly helpful and engaging user experience.
              </p>
            </CardContent>
          </Card>

          <Card className="dark:neon-border">
            <CardHeader>
              <CardTitle>Core Features</CardTitle>
              <CardDescription>A look at what makes Notora special.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                  {feature.icon}
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="dark:neon-border">
            <CardHeader>
              <CardTitle>Meet the Creator</CardTitle>
              <CardDescription>This application was built as a portfolio project.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src="/rahul_pic.png" alt="Creator Avatar" data-ai-hint="person avatar" />
                <AvatarFallback>R</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left">
                <h3 className="text-xl font-semibold">Rahul Pandey</h3>
                <p className="text-muted-foreground">
                  This project showcases my ability to build full-stack, responsive, and AI-integrated web applications.
                  I am passionate about creating intuitive and powerful tools that solve real-world problems.
                </p>
                <div className="mt-4 flex justify-center sm:justify-start">
                  <Button asChild variant="outline">
                    <Link href="https://rahul-pandey-ai-portfolio.vercel.app/" target="_blank" rel="noopener noreferrer">
                      View My Portfolio <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </AppLayout>
  );
}
