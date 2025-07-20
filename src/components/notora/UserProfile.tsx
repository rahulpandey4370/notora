'use client';

import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon, Award, Bell } from 'lucide-react';
import type { User, UserStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface UserProfileProps {
  user: User;
  userStats: UserStats;
}

export default function UserProfile({ user, userStats }: UserProfileProps) {
  const { logout } = useAuth();
  const { toast } = useToast();

  const handleEnableNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast({
        variant: 'destructive',
        title: 'Unsupported Browser',
        description: 'Your browser does not support push notifications.',
      });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast({
        title: 'Notifications Enabled!',
        description: 'You will now receive updates from Notora.',
      });
      // In a real app, you would now get the push subscription
      // and send it to your server to be stored.
      // navigator.serviceWorker.ready.then(registration => {
      //   registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY' })
      //     .then(subscription => {
      //       console.log('Push Subscription:', subscription);
      //       // TODO: Send subscription to your backend
      //     });
      // });
    } else {
       toast({
        variant: 'destructive',
        title: 'Notifications Denied',
        description: 'You have blocked notifications. You can change this in your browser settings.',
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatarUrl} alt={user.username} data-ai-hint="user avatar" />
            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              Welcome back!
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
            <Award className="mr-2 h-4 w-4"/>
            <span>{userStats.xp} XP Total</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEnableNotifications}>
          <Bell className="mr-2 h-4 w-4" />
          <span>Enable Notifications</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
