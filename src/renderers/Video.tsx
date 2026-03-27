import * as React from "react";
import Spinner from "../components/Spinner";
import { Renderer, Tester } from "./../interfaces";
import WithHeader from "./wrappers/withHeader";
import WithSeeMore from "./wrappers/withSeeMore";

export const renderer: Renderer = ({
  story,
  action,
  isPaused,
  config,
  messageHandler,
}) => {
  const [loaded, setLoaded] = React.useState(false);
  const [muted, setMuted] = React.useState(story.muted || false);
  const { width, height, loader, storyStyles } = config;

  let computedStyles = {
    ...styles.storyContent,
    ...(storyStyles || {}),
  };

  let vid = React.useRef<HTMLVideoElement>(null);

  // CRITICAL: Cleanup on unmount — stops video from playing in background
  // after swiping away or closing the story viewer
  React.useEffect(() => {
    const videoEl = vid.current;
    return () => {
      if (videoEl) {
        videoEl.pause();
        videoEl.currentTime = 0;
        // Detach src so browser fully releases the media resource
        // This prevents audio ghost-playing on Capacitor
        videoEl.removeAttribute("src");
        videoEl.load();
      }
    };
  }, []);

  // Reset video state when story URL changes (navigating between stories)
  React.useEffect(() => {
    setLoaded(false);
    if (vid.current) {
      vid.current.pause();
      vid.current.currentTime = 0;
    }
  }, [story.url]);

  // Handle pause/play from parent (isPaused prop)
  React.useEffect(() => {
    if (!vid.current || !loaded) return;
    if (isPaused) {
      vid.current.pause();
    } else {
      vid.current.play().catch(() => {});
    }
  }, [isPaused, loaded]);

  const onWaiting = () => {
    action("pause", true);
  };

  const onPlaying = () => {
    action("play", true);
  };

  const videoLoaded = () => {
    if (!vid.current) return;
    messageHandler("UPDATE_VIDEO_DURATION", { duration: vid.current.duration });
    setLoaded(true);
    // Reset to beginning to avoid resuming mid-play when revisiting
    vid.current.currentTime = 0;
    vid.current
      .play()
      .then(() => {
        action("play");
      })
      .catch(() => {
        setMuted(true);
        // vid.current?.play().finally(() => {
        //   action("play");
        // });
        vid.current
          ?.play()
          .then(() => action("play"))
          .catch(() => action("play"));
      });
  };

  return (
    <WithHeader {...{ story, globalHeader: config.header }}>
      <WithSeeMore {...{ story, action }}>
        <div style={styles.videoContainer}>
          <video
            ref={vid}
            style={computedStyles}
            src={story.url}
            controls={false}
            onLoadedData={videoLoaded}
            playsInline
            onWaiting={onWaiting}
            onPlaying={onPlaying}
            muted={muted}
            autoPlay
            webkit-playsinline="true"
            // Prevent looping — the progress bar handles advancement
            loop={false}
            // Preload metadata so duration is available faster
            preload="metadata"
          />
          {!loaded && (
            <div
              style={{
                width: width,
                height: height,
                position: "absolute",
                left: 0,
                top: 0,
                background: "rgba(0, 0, 0, 0.9)",
                zIndex: 9,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                color: "#ccc",
              }}
            >
              {loader || <Spinner />}
            </div>
          )}
        </div>
      </WithSeeMore>
    </WithHeader>
  );
};

const styles = {
  storyContent: {
    width: "auto",
    maxWidth: "100%",
    maxHeight: "100%",
    margin: "auto",
  },
  videoContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
};

export const tester: Tester = (story) => {
  return {
    condition: story.type === "video",
    priority: 2,
  };
};

export default {
  renderer,
  tester,
};
