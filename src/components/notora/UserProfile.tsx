
'use client';

import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, User as UserIcon, Award, Bell, KeyRound, Loader2 } from 'lucide-react';
import type { User, UserStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface UserProfileProps {
  user: User;
  userStats: UserStats;
}

export default function UserProfile({ user, userStats }: UserProfileProps) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);


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
    } else {
       toast({
        variant: 'destructive',
        title: 'Notifications Denied',
        description: 'You have blocked notifications. You can change this in your browser settings.',
      });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'New password must be at least 6 characters long.' });
      return;
    }
    
    setPasswordChangeLoading(true);
    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                currentPassword,
                newPassword
            })
        });

        if (response.ok) {
            toast({ title: 'Password changed successfully!' });
            setIsPasswordDialogOpen(false);
        } else {
            const errorData = await response.json();
            toast({ variant: 'destructive', title: 'Failed to change password', description: errorData.error || 'An unknown error occurred.' });
        }
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'An error occurred', description: 'Please try again later.' });
    } finally {
        setPasswordChangeLoading(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
    }
  }

  return (
    <>
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
        <DropdownMenuItem onSelect={() => setIsPasswordDialogOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            <span>Change Password</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    
    <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Change Your Password</DialogTitle>
                <DialogDescription>Enter your current and new password below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="current-password" className="text-right">Current</Label>
                    <Input id="current-password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="new-password" className="text-right">New</Label>
                    <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="confirm-password" className="text-right">Confirm</Label>
                    <Input id="confirm-password" type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleChangePassword} disabled={passwordChangeLoading}>
                    {passwordChangeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
