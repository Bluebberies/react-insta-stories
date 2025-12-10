import React, { useContext, useState, useEffect, useRef } from "react";
import Progress from "./Progress";
import {
  ProgressContext,
  GlobalCtx,
  StoriesContext as StoriesContextInterface,
} from "./../interfaces";
import ProgressCtx from "./../context/Progress";
import GlobalContext from "./../context/Global";
import StoriesContext from "./../context/Stories";
import { timestamp } from "../util/time";

export default () => {
  const [count, setCount] = useState<number>(0);
  const lastTime = useRef<number>();
  const [videoDurationLoaded, setVideoDurationLoaded] = useState<number | null>(null);

  const { currentId, next, videoDuration, pause, bufferAction } =
    useContext<ProgressContext>(ProgressCtx);
  const {
    defaultInterval,
    onStoryEnd,
    onStoryStart,
    progressContainerStyles,
  } = useContext<GlobalCtx>(GlobalContext);
  const { stories } = useContext<StoriesContextInterface>(StoriesContext);

  useEffect(() => {
    setCount(0);
  }, [currentId, stories]);

  // FIX: Pre-load video metadata BEFORE starting the timer
  useEffect(() => {
    setVideoDurationLoaded(null);
    
    if (stories[currentId]?.type === "video" && stories[currentId]?.url) {
      // For videos, pre-load the duration before timer starts
      const loadVideoDuration = () => {
        const video = document.createElement("video");
        
        const onLoadedMetadata = () => {
          const durationMs = video.duration * 1000;
          setVideoDurationLoaded(durationMs);
          cleanup();
        };
        
        const onError = () => {
          // Fallback to 5 seconds if video fails to load
          setVideoDurationLoaded(5000);
          cleanup();
        };
        
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("error", onError);
          video.src = "";
        };
        
        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("error", onError);
        video.crossOrigin = "anonymous";
        video.src = stories[currentId].url;
      };
      
      loadVideoDuration();
    }
  }, [currentId, stories]);

  // FIX: Only start timer after video duration is pre-loaded
  useEffect(() => {
    // For images: start timer immediately
    // For videos: wait until duration is loaded
    const shouldStartTimer = 
      stories[currentId]?.type !== "video" || 
      videoDurationLoaded !== null;

    if (!pause && shouldStartTimer) {
      animationFrameId.current = requestAnimationFrame(incrementCount);
      lastTime.current = timestamp();
    }
    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [currentId, pause, videoDurationLoaded]);

  let animationFrameId = useRef<number>();

  let countCopy = count;
  const incrementCount = () => {
    if (countCopy === 0) storyStartCallback();
    if (lastTime.current == undefined) lastTime.current = timestamp();
    const t = timestamp();
    const dt = t - lastTime.current;
    lastTime.current = t;
    setCount((count: number) => {
      const interval = getCurrentInterval();
      countCopy = count + (dt * 100) / interval;
      return countCopy;
    });
    if (countCopy < 100) {
      animationFrameId.current = requestAnimationFrame(incrementCount);
    } else {
      storyEndCallback();
      cancelAnimationFrame(animationFrameId.current);
      next();
    }
  };

  const storyStartCallback = () => {
    onStoryStart && onStoryStart(currentId, stories[currentId]);
  };

  const storyEndCallback = () => {
    onStoryEnd && onStoryEnd(currentId, stories[currentId]);
  };

  // FIX: Use pre-loaded video duration instead of the global videoDuration
  const getCurrentInterval = () => {
    if (stories[currentId].type === "video") {
      // Use the pre-loaded duration gotten from the video element
      if (videoDurationLoaded !== null && videoDurationLoaded > 0) {
        return videoDurationLoaded;
      }
      // Fallback to duration property if pre-load failed
      if (typeof stories[currentId].duration === "number")
        return stories[currentId].duration;
      // Final fallback
      return defaultInterval;
    }
    
    if (typeof stories[currentId].duration === "number")
      return stories[currentId].duration;
    return defaultInterval;
  };

  const opacityStyles = {
    opacity: pause && !bufferAction ? 0 : 1,
  };

  return (
    <div style={{
      ...styles.progressArr,
      ...progressContainerStyles,
      ...opacityStyles
    }}>
      {stories.map((_, i) => (
        <Progress
          key={i}
          count={count}
          width={1 / stories.length}
          active={i === currentId ? 1 : i < currentId ? 2 : 0}
        />
      ))}
    </div>
  );
};

const styles = {
  progressArr: {
    display: "flex",
    justifyContent: "center",
    maxWidth: "100%",
    flexWrap: "nowrap" as const,
    position: "absolute" as const,
    width: "98%",
    padding: 5,
    paddingTop: 7,
    alignSelf: "center",
    zIndex: 1001,
    filter: "drop-shadow(0 1px 8px #222)",
    transition: "opacity 400ms ease-in-out",
  },
};
