import React, { useEffect, useRef, useState, MutableRefObject } from "react";
import Draggable from "react-draggable";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className="border px-3 py-1 rounded w-full" {...props} />
);

const Button = ({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
    {...props}
  >
    {children}
  </button>
);

const Card = ({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`border rounded-xl shadow p-4 bg-white relative ${className}`}
    {...props}
  >
    {children}
  </div>
);

const CardContent = ({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`space-y-2 ${className}`} {...props}>
    {children}
  </div>
);

type Clip = {
  id: number;
  videoId: string;
  title?: string;
  start: number;
  audioStart: number;
  audioEnd: number;
  end: number;
};

interface SortableClipProps {
  clip: Clip;
  updateClip: (clipId: number, field: keyof Clip, value: number) => void;
  loadClipVideo: (videoId: string) => void;
  deleteClip: (clipId: number) => void;
  renderTimelineSlider: (
    clip: Clip,
    onUpdate?: (field: keyof Clip, value: number) => void
  ) => React.ReactElement;
}

function SortableClip({
  clip,
  updateClip,
  loadClipVideo,
  deleteClip,
  renderTimelineSlider,
}: SortableClipProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDelete = () => {
    console.log("Deleting clip with ID:", clip.id);
    deleteClip(clip.id);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="mt-4">
        <div
          className="cursor-move absolute top-2 left-2"
          {...attributes}
          {...listeners}
        >
          ☰
        </div>
        <div className="absolute top-2 right-2 space-x-2">
          <Button
            className="text-xs px-2 py-1"
            onClick={() => loadClipVideo(clip.videoId)}
          >
            Activate
          </Button>
          <Button
            className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600"
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
        <CardContent>
          <div className="font-medium">{clip.title || "Untitled Video"}</div>
          <div className="text-sm text-gray-600">Video ID: {clip.videoId}</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Input type="number" step="0.1" value={clip.start} readOnly />
            <Input type="number" step="0.1" value={clip.audioStart} readOnly />
            <Input type="number" step="0.1" value={clip.audioEnd} readOnly />
            <Input type="number" step="0.1" value={clip.end} readOnly />
          </div>
          {renderTimelineSlider(clip, (field: keyof Clip, value: number) =>
            updateClip(clip.id, field, value)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClipEditor() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [videoId, setVideoId] = useState<string>("");
  const [draftClip, setDraftClip] = useState<Clip | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(60);
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  // Using any because YouTube's player type definitions are not installed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const timelineTimeoutRef = useRef<number | null>(null);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [YT, setYT] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (timelineTimeoutRef.current) {
        clearTimeout(timelineTimeoutRef.current);
      }
    };
  }, []);

  const globalMarkerRefs: Record<
    string,
    MutableRefObject<HTMLDivElement | null>
  > = {
    start: useRef(null),
    audioStart: useRef(null),
    audioEnd: useRef(null),
    end: useRef(null),
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => setYT(window.YT);
    } else {
      setYT(window.YT);
    }
  }, []);

  useEffect(() => {
    if (YT && videoId) {
      const player = new YT.Player("player", {
        videoId,
        events: {
          onReady: () => {
            playerRef.current = player;
            const duration = player.getDuration();
            if (duration) setVideoDuration(duration);
          },
        },
      });
    }
  }, [YT, videoId]);

  const updateClip = (clipId: number, field: keyof Clip, value: number) => {
    setClips((prev) =>
      prev.map((clip) =>
        clip.id === clipId ? { ...clip, [field]: value } : clip
      )
    );
  };

  const deleteClip = (clipId: number) => {
    console.log("Deleting clip with ID:", clipId);
    setClips((prev) => prev.filter((clip) => clip.id !== clipId));
  };

  const updateDraftClip = (field: keyof Clip, value: number) => {
    if (draftClip) {
      setDraftClip({ ...draftClip, [field]: value });
    }
  };

  const confirmClip = async () => {
    if (draftClip && draftClip.videoId?.trim()) {
      let title = "Untitled Video";
      try {
        const url = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${draftClip.videoId.trim()}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.title) title = data.title;
      } catch (err) {
        console.error("Failed to fetch title", err);
      }
      setClips((prev) => [...prev, { ...draftClip, title }]);
      setDraftClip(null);
    } else {
      console.warn("Invalid draftClip or videoId");
    }
  };

  const TimelineSlider = ({
    clip,
    onUpdate,
  }: {
    clip: Clip;
    onUpdate?: (field: keyof Clip, value: number) => void;
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
      const handleResize = () => {
        if (containerRef.current) {
          setWidth(containerRef.current.clientWidth);
        }
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    const max = videoDuration;
    const viewRange = max / timelineZoom;
    const center = (clip.start + clip.end) / 2;
    const rangeStart = Math.min(
      Math.max(0, center - viewRange / 2),
      max - viewRange
    );
    const markers = ["start", "audioStart", "audioEnd", "end"] as const;

    return (
      <div className="space-y-2">
        <div
          ref={containerRef}
          className="relative h-10 bg-gray-200 rounded flex items-center overflow-hidden w-full"
        >
          {width > 0 &&
            markers.map((field) => {
              const x = ((clip[field] - rangeStart) / viewRange) * width;
              const color = field === "audioStart" || field === "audioEnd" ? "blue" : "red";
              const style =
                field === "audioStart"
                  ? {
                      width: 0,
                      height: 0,
                      borderTop: "8px solid transparent",
                      borderBottom: "8px solid transparent",
                      borderRight: `8px solid ${color}`,
                    }
                  : field === "audioEnd"
                  ? {
                      width: 0,
                      height: 0,
                      borderTop: "8px solid transparent",
                      borderBottom: "8px solid transparent",
                      borderLeft: `8px solid ${color}`,
                    }
                  : {
                      width: "16px",
                      height: "16px",
                      borderRadius: "9999px",
                      backgroundColor: color,
                    };

              return onUpdate ? (
                <Draggable
                  key={field}
                  axis="x"
                  bounds="parent"
                  nodeRef={globalMarkerRefs[field] as React.RefObject<HTMLDivElement>}
                  position={{ x, y: 0 }}
                  onDrag={(_, data) => {
                    const newValue = rangeStart + (data.x / width) * viewRange;
                    onUpdate(field, parseFloat(newValue.toFixed(2)));
                  }}
                >
                  <div
                    ref={globalMarkerRefs[field]}
                    className="cursor-pointer absolute"
                    style={{ left: 0, ...style }}
                    title={field}
                  />
                </Draggable>
              ) : (
                <div
                  key={field}
                  className="absolute"
                  style={{ left: `${x}px`, ...style }}
                  title={field}
                />
              );
            })}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Start: {clip.start}s</span>
          <span>Audio Start: {clip.audioStart}s</span>
          <span>Audio End: {clip.audioEnd}s</span>
          <span>End: {clip.end}s</span>
        </div>
      </div>
    );
  };

  const renderTimelineSlider = (
    clip: Clip,
    onUpdate?: (field: keyof Clip, value: number) => void
  ) => <TimelineSlider clip={clip} onUpdate={onUpdate} />;

  const startDraft = () => {
    if (!videoId || !videoId.trim()) return;
    const cleanId = videoId.trim();
    setDraftClip({
      id: Date.now(),
      videoId: cleanId,
      start: 0,
      audioStart: 2,
      audioEnd: 8,
      end: 10,
    });
    playerRef.current?.loadVideoById?.(cleanId);
  };

  const loadClipVideo = (clipVideoId: string) => {
    setVideoId(clipVideoId);
    playerRef.current?.loadVideoById?.(clipVideoId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = clips.findIndex((c) => c.id === active.id);
      const newIndex = clips.findIndex((c) => c.id === over?.id);
      setClips((prev) => arrayMove(prev, oldIndex, newIndex));
    }
  };

  const stopTimelinePlayback = () => {
    if (timelineTimeoutRef.current) {
      clearTimeout(timelineTimeoutRef.current);
      timelineTimeoutRef.current = null;
    }
    playerRef.current?.pauseVideo?.();
    setIsTimelinePlaying(false);
  };

  const playTimeline = () => {
    if (!clips.length) return;
    let index = 0;
    setIsTimelinePlaying(true);

    const playNext = () => {
      if (index >= clips.length) {
        setIsTimelinePlaying(false);
        return;
      }
      const clip = clips[index];
      playerRef.current?.loadVideoById?.({
        videoId: clip.videoId,
        startSeconds: clip.start,
      });
      playerRef.current?.playVideo?.();
      timelineTimeoutRef.current = window.setTimeout(() => {
        index += 1;
        playNext();
      }, (clip.end - clip.start) * 1000);
    };

    stopTimelinePlayback();
    playNext();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex space-x-2">
        <Input
          placeholder="YouTube Video ID"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
        />
        <Button onClick={startDraft}>Edit Clip</Button>
      </div>

      <div className="aspect-video" id="player"></div>

      {draftClip && (
        <>
          {renderTimelineSlider(draftClip, updateDraftClip)}
          <Button onClick={confirmClip}>Add to Timeline</Button>
        </>
      )}

      {(draftClip || clips.length > 0) && (
        <div className="flex items-center space-x-2">
          <span className="text-sm">Zoom:</span>
          <Button
            className="px-2 py-1"
            onClick={() =>
              setTimelineZoom((z) => Math.max(0.5, parseFloat((z - 0.5).toFixed(1))))
            }
          >
            -
          </Button>
          <span className="text-sm w-10 text-center">{(timelineZoom * 100).toFixed(0)}%</span>
          <Button
            className="px-2 py-1"
            onClick={() =>
              setTimelineZoom((z) => Math.min(5, parseFloat((z + 0.5).toFixed(1))))
            }
          >
            +
          </Button>
        </div>
      )}

      {clips.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Timeline Clips</h2>
            <Button onClick={isTimelinePlaying ? stopTimelinePlayback : playTimeline}>
              {isTimelinePlaying ? "Stop" : "Play Timeline"}
            </Button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={clips.map((clip) => clip.id)}
              strategy={verticalListSortingStrategy}
            >
              {clips.map((clip) => (
                <SortableClip
                  key={clip.id}
                  clip={clip}
                  updateClip={updateClip}
                  loadClipVideo={loadClipVideo}
                  deleteClip={deleteClip}
                  renderTimelineSlider={renderTimelineSlider}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
