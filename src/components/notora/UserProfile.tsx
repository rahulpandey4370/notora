
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
import { LogOut, User as UserIcon, Award, Bell, KeyRound, Loader2, Gauge, Globe, Cpu, Wand2, CalendarRange } from 'lucide-react';
import AiModelsDialog from './AiModelsDialog';
import { Switch } from '@/components/ui/switch';
import { useModelStore } from '@/hooks/use-model-store';
import Link from 'next/link';
import type { User, UserStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface UserProfileProps {
  user: User;
  userStats: UserStats;
  /** Day End Summary and Weekly Review: shown here on phones, where the top bar has no room for them. */
  onDayEnd?: () => void;
  onWeekly?: () => void;
}

export default function UserProfile({ user, userStats, onDayEnd, onWeekly }: UserProfileProps) {
  const [modelsOpen, setModelsOpen] = useState(false);
  const { logout } = useAuth();
  const { toast } = useToast();
  const { webSearch, setWebSearch } = useModelStore();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);


  const push = usePushNotifications();
  const togglePush = async () => {
    try {
      if (push.status === 'on') {
        await push.disable();
        toast({ title: 'Notifications off on this device' });
      } else {
        await push.enable();
        toast({ title: 'Notifications on', description: 'A test notification is on its way.' });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Couldn't change notifications", description: e?.message });
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
            // Only now: after a failure the dialog keeps what was typed, so one wrong field doesn't mean retyping all three.
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } else {
            const errorData = await response.json();
            toast({ variant: 'destructive', title: 'Failed to change password', description: errorData.error || 'An unknown error occurred.' });
        }
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'An error occurred', description: 'Please try again later.' });
    } finally {
        setPasswordChangeLoading(false);
    }
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-11 w-11 rounded-full" aria-label="Account menu">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatarUrl} alt={user.username} data-ai-hint="user avatar" />
            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60 max-md:[&_[role=menuitem]]:min-h-11" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              Welcome back!
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile"><UserIcon className="mr-2 h-4 w-4" /><span>Profile &amp; settings</span></Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
            <Award className="mr-2 h-4 w-4"/>
            <span>{userStats.xp} XP Total</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); void togglePush(); }}
          disabled={push.busy || push.status === 'loading'}
        >
          <Bell className="mr-2 h-4 w-4" />
          <span>
            {push.status === 'on' ? 'Turn off notifications'
              : push.status === 'blocked' ? 'Notifications blocked'
              : 'Enable notifications'}
          </span>
        </DropdownMenuItem>
        {onDayEnd && <DropdownMenuItem className="md:hidden" onSelect={onDayEnd}><Wand2 className="mr-2 h-4 w-4" /><span>Day End Summary</span></DropdownMenuItem>}
        {onWeekly && <DropdownMenuItem className="md:hidden" onSelect={onWeekly}><CalendarRange className="mr-2 h-4 w-4" /><span>Weekly Review</span></DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => setModelsOpen(true)}>
          <Cpu className="mr-2 h-4 w-4" />
          <span>AI models</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setWebSearch(!webSearch); }}>
          <Globe className="mr-2 h-4 w-4" />
          <span className="flex-1">Web search for AI</span>
          <Switch checked={webSearch} aria-label="Web search for AI" className="pointer-events-none ml-2" tabIndex={-1} />
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/usage"><Gauge className="mr-2 h-4 w-4" /><span>AI usage &amp; cost</span></Link>
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
    
    <AiModelsDialog open={modelsOpen} onOpenChange={setModelsOpen} />

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
