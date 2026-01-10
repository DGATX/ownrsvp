'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  authorName: string;
  content: string;
  createdAt: Date;
  guest?: {
    name: string | null;
    email: string;
  } | null;
}

interface EventCommentsProps {
  comments: Comment[];
}

export function EventComments({ comments }: EventCommentsProps) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No comments yet.</p>
        <p className="text-sm">Guests can leave messages on the public event page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Messages ({comments.length})
        </h3>
      )}
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-sm font-medium">
              {comment.authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{comment.authorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{comment.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

