import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Link2, Unlink, ExternalLink, Copy } from 'lucide-react';

const TelegramTab = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser, setTelegramUser] = useState<any>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const botUsername = 'ComplianceIQBot';

  useEffect(() => {
    fetchTelegramLink();
  }, [user]);

  const fetchTelegramLink = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('telegram_users' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setTelegramUser(data);
    } catch (error) {
      console.error('Error fetching telegram link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLinkUrl = () => {
    if (!user) return '';
    const code = btoa(user.id);
    return `https://t.me/${botUsername}?start=${code}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getLinkUrl());
    toast.success('Link copied to clipboard');
  };

  const handleUnlink = async () => {
    if (!user) return;
    setIsUnlinking(true);
    try {
      const { error } = await supabase
        .from('telegram_users' as any)
        .update({ is_active: false } as any)
        .eq('user_id', user.id);

      if (error) throw error;
      setTelegramUser(null);
      toast.success('Telegram account unlinked');
    } catch (error) {
      console.error('Error unlinking:', error);
      toast.error('Failed to unlink account');
    } finally {
      setIsUnlinking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Telegram Bot
          </CardTitle>
          <CardDescription>
            Connect your Telegram account to query properties, get violation alerts, and receive daily digests via Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {telegramUser ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-primary/5">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {telegramUser.first_name || 'Telegram User'}
                    </p>
                    <Badge variant="default" className="text-xs">Connected</Badge>
                  </div>
                  {telegramUser.username && (
                    <p className="text-sm text-muted-foreground">@{telegramUser.username}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Linked {new Date(telegramUser.linked_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={isUnlinking}
                  className="text-destructive hover:text-destructive"
                >
                  {isUnlinking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-1" />
                      Unlink
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">What you can do:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Ask about violations: <span className="italic">"Violations at 123 Main St"</span></li>
                  <li>• Check compliance: <span className="italic">"Compliance status for all properties"</span></li>
                  <li>• Query hearings: <span className="italic">"Upcoming hearings this week"</span></li>
                  <li>• Tax status: <span className="italic">"Tax balance for 456 Oak Ave"</span></li>
                  <li>• Quick overview: Send <code className="bg-muted px-1 rounded">/status</code></li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-dashed border-border">
                <h4 className="font-medium text-foreground mb-2">Connect Your Telegram</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Click the button below to open Telegram and link your account. This lets you query your property data and receive alerts directly in Telegram.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <a
                      href={getLinkUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Open in Telegram
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                  <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">How it works:</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Click "Open in Telegram" above</li>
                  <li>Press "Start" in the bot chat</li>
                  <li>Your account will be linked automatically</li>
                  <li>Start asking questions about your properties!</li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramTab;
