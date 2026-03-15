import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "@tanstack/react-db";
import { useState } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isAfter,
  startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { videosCollection, getEventDirHandle } from "../packlets/video-store";
import { VideoThumbnail } from "#/components/video-thumbnail";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: videos } = useLiveQuery((q) =>
    q.from({ v: videosCollection }).select(({ v }) => ({
      id: v.id,
      event: v.event,
      slug: v.slug,
      title: v.data.title,
      speaker: v.data.speaker,
      published: v.data.published,
    })),
  );

  const scheduledVideos = (videos ?? [])
    .filter((v) => typeof v.published === "string")
    .map((v) => ({
      ...v,
      publishedDate: parseISO(v.published as string),
    }))
    .sort((a, b) => a.publishedDate.getTime() - b.publishedDate.getTime());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const videosByDate = new Map<string, typeof scheduledVideos>();
  for (const video of scheduledVideos) {
    const dateKey = format(video.publishedDate, "yyyy-MM-dd");
    const existing = videosByDate.get(dateKey) ?? [];
    existing.push(video);
    videosByDate.set(dateKey, existing);
  }

  const upcomingVideos = scheduledVideos.filter((v) =>
    isAfter(v.publishedDate, startOfDay(new Date())),
  );

  return (
    <main className="page-wrap px-4 py-12">
      <div className="island-shell rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={14} />
              All events
            </Link>
            <h1 className="text-2xl font-bold">Publishing Calendar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {scheduledVideos.length} scheduled videos
              {upcomingVideos.length > 0 &&
                ` · ${upcomingVideos.length} upcoming`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-24 border-r border-b bg-muted/30 p-1"
              />
            ))}
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayVideos = videosByDate.get(dateKey) ?? [];
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={dateKey}
                  className={`min-h-24 border-r border-b p-1 ${isCurrentDay ? "bg-primary/10 dark:bg-primary/20" : ""}`}
                >
                  <div
                    className={`mb-1 text-xs font-medium ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayVideos.slice(0, 3).map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))}
                    {dayVideos.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{dayVideos.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">
            Upcoming Scheduled Videos
          </h2>
          {upcomingVideos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming scheduled videos.
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingVideos.map((video) => (
                <Link
                  key={video.id}
                  to="/videos/$event/$slug"
                  params={{ event: video.event, slug: video.slug }}
                >
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50">
                    <VideoThumbnail
                      event={video.event}
                      slug={video.slug}
                      getEventDirHandle={getEventDirHandle}
                      alt={video.title}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{video.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {video.event}/{video.slug}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">
                        {format(video.publishedDate, "MMM d")}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function VideoCard({
  video,
}: {
  video: {
    id: string;
    event: string;
    slug: string;
    title: string;
    publishedDate: Date;
  };
}) {
  return (
    <Link
      to="/videos/$event/$slug"
      params={{ event: video.event, slug: video.slug }}
    >
      <div className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80">
        {video.title}
      </div>
    </Link>
  );
}
