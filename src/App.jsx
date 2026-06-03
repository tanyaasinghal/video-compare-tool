import { useState, useRef, useEffect } from "react";

function App() {
  const [modelAFolder, setModelAFolder] =
    useState("");

  const [modelBFolder, setModelBFolder] =
    useState("");

  const [modelAFiles, setModelAFiles] =
    useState([]);

  const [modelBFiles, setModelBFiles] =
    useState([]);

  const [videoPairs, setVideoPairs] =
    useState([]);

  const [
    currentPairIndex,
    setCurrentPairIndex,
  ] = useState(0);

  const [leftVideo, setLeftVideo] =
    useState("");

  const [rightVideo, setRightVideo] =
    useState("");

  const [isTranscoding, setIsTranscoding] =
    useState(false);

  const leftVideoRef =
    useRef(null);

  const rightVideoRef =
    useRef(null);

  const transcodedCache =
    useRef({});

  const loadingPairRef =
    useRef(null);

  const navigationLockRef =
    useRef(false);

  const normalizeName = (file) => {
    const withoutExtension =
      file.name.replace(".mp4", "");

    const parts =
      withoutExtension.split("_");

    parts.pop();

    return parts.join("_");
  };

  const createPairs = (
    aFiles,
    bFiles
  ) => {
    const pairs = [];

    const bMap = {};

    bFiles.forEach((file) => {
      const normalized =
        normalizeName(file);

      bMap[normalized] = file;
    });

    aFiles.forEach((aFile) => {
      const normalized =
        normalizeName(aFile);

      if (bMap[normalized]) {
        pairs.push({
          id: normalized,
          left: aFile,
          right: bMap[normalized],
        });
      }
    });

    console.log("VIDEO PAIRS:", pairs);

    setCurrentPairIndex(0);
    setVideoPairs(pairs);

    loadPair(pairs);
  };

  const loadPair =
    async (
      pairs,
      index = currentPairIndex
    ) => {
      navigationLockRef.current =
        true;

      if (pairs.length === 0)
        return;

      try {
        setIsTranscoding(true);

        setLeftVideo("");
        setRightVideo("");

        const pair =
          pairs[index];
        loadingPairRef.current =
          pair.id;

        const cached =
          transcodedCache.current[pair.id];

        if (cached) {
          console.log(
            "LOADING FROM CACHE"
          );

          setLeftVideo(cached.left);
          setRightVideo(cached.right);
          setIsTranscoding(false);
          return;
        }

        console.log(
          "TRANSCODING LEFT..."
        );

        const leftPath =
          await window.electronAPI
            .transcodeVideo(
              pair.left.fullPath
            );

        console.log(
          "TRANSCODING RIGHT..."
        );

        const rightPath =
          await window.electronAPI
            .transcodeVideo(
              pair.right.fullPath
            );
        if (
          loadingPairRef.current !==
          pair.id
        ) {
          console.log(
            "STALE LOAD IGNORED"
          );

          return;
        }

        const formattedLeft =
          `file:///${leftPath.replaceAll(
            "\\",
            "/"
          )}`;

        const formattedRight =
          `file:///${rightPath.replaceAll(
            "\\",
            "/"
          )}`;

        console.log(
          "FORMATTED LEFT:",
          formattedLeft
        );

        console.log(
          "FORMATTED RIGHT:",
          formattedRight
        );

        setLeftVideo(formattedLeft);
        setRightVideo(formattedRight);

        setTimeout(() => {
          if (leftVideoRef.current) {
            leftVideoRef.current.currentTime = 0;
          }

          if (rightVideoRef.current) {
            rightVideoRef.current.currentTime = 0;
          }
        }, 100);

        transcodedCache.current[
          pair.id
        ] = {
          left: formattedLeft,
          right: formattedRight,
        };

        console.log(
          "VIDEOS READY"
        );
      } catch (error) {
        console.log(
          "TRANSCODE ERROR:",
          error
        );
      } finally {
        setIsTranscoding(false);
        navigationLockRef.current =
          false;
      }
    };

  const selectFolder = async (
    type
  ) => {
    const folder =
      await window.electronAPI.selectFolder();

    if (!folder) return;

    const files =
      await window.electronAPI.readFolder(
        folder
      );

    if (type === "A") {
      setModelAFolder(folder);
      setModelAFiles(files);

      if (modelBFiles.length > 0) {
        createPairs(files, modelBFiles);
      }
    } else {
      setModelBFolder(folder);
      setModelBFiles(files);

      if (modelAFiles.length > 0) {
        createPairs(modelAFiles, files);
      }
    }
  };

  const FRAME_TIME =
    1 / 60;

  const togglePlayPause = () => {
    const left =
      leftVideoRef.current;

    const right =
      rightVideoRef.current;

    if (!left || !right) return;

    if (left.paused) {
      left.play();
      right.play();
    } else {
      left.pause();
      right.pause();
    }
  };

  const stepFrame = (
    direction
  ) => {
    const left =
      leftVideoRef.current;

    const right =
      rightVideoRef.current;

    if (!left || !right) return;

    left.pause();
    right.pause();

    left.currentTime +=
      FRAME_TIME * direction;

    right.currentTime +=
      FRAME_TIME * direction;
  };

  const syncVideos = () => {
    const left =
      leftVideoRef.current;

    const right =
      rightVideoRef.current;

    if (!left || !right) return;

    right.currentTime =
      left.currentTime;

    console.log(
      "VIDEOS RESYNCED"
    );
  };

  const navigatePair = (
    direction
  ) => {
    if (
      navigationLockRef.current
    ) {
      return;
    }

    if (videoPairs.length === 0)
      return;

    let newIndex =
      currentPairIndex +
      direction;

    if (newIndex < 0)
      newIndex = 0;

    if (
      newIndex >=
      videoPairs.length
    ) {
      newIndex =
        videoPairs.length - 1;
    }

    if (
      newIndex ===
      currentPairIndex
    ) {
      return;
    }

    setCurrentPairIndex(newIndex);

    loadPair(
      videoPairs,
      newIndex
    );
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      }

      if (e.code === "KeyD") {
        e.preventDefault();
        stepFrame(1);
      }

      if (e.code === "KeyA") {
        e.preventDefault();
        stepFrame(-1);
      }

      if (e.code === "ArrowRight") {
        e.preventDefault();
        navigatePair(1);
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        navigatePair(-1);
      }

      if (e.code === "KeyW") {
        e.preventDefault();
        syncVideos();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [currentPairIndex, videoPairs]);

  return (
    <div
      style={{
        padding: "0px",
        background: "#0f172a",
        height: "100vh",
        overflow: "hidden",
        color: "white",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: "20px",
          fontWeight: "700",
          marginBottom: "10px",
        }}
      >
        Video Compare Tool
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "5px",
        }}
      >
        <button
          onClick={() =>
            selectFolder("A")
          }
          style={buttonStyle}
        >
          Select Model A Folder
        </button>

        <button
          onClick={() =>
            selectFolder("B")
          }
          style={buttonStyle}
        >
          Select Model B Folder
        </button>
      </div>

      {isTranscoding && (
        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            background: "#7c2d12",
            borderRadius: "10px",
            fontSize: "18px",
            fontWeight: "600",
          }}
        >
          Transcoding videos...
        </div>
      )}
      <div
        style={{
          marginTop: "10px",
          fontSize: "16px",
          fontWeight: "600",
        }}
      >
        Pair {currentPairIndex + 1}
        /
        {videoPairs.length}

        {" | "}

        {
          videoPairs[currentPairIndex]
            ?.id
        }
      </div>
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "10px",
          width: "100%",
          height: "calc(100vh - 120px)",
        }}
      >
        <div
          style={{
            flex: 1,
          }}
        >


          <video
            key={`left-${currentPairIndex}`}
            src={leftVideo}
            ref={leftVideoRef}
            controls
            onLoadedMetadata={() =>
              console.log(
                "LEFT VIDEO LOADED"
              )
            }
            onError={(e) =>
              console.log(
                "LEFT VIDEO ERROR",
                e
              )
            }
            style={{
              width: "100%",
              height: "92vh",
              objectFit: "contain",
              background: "#000",
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
          }}
        >

          <video
            key={`right-${currentPairIndex}`}
            src={rightVideo}
            ref={rightVideoRef}
            controls
            onLoadedMetadata={() =>
              console.log(
                "RIGHT VIDEO LOADED"
              )
            }
            onError={(e) =>
              console.log(
                "RIGHT VIDEO ERROR",
                e
              )
            }
            style={{
              width: "100%",
              height: "92vh",
              objectFit: "contain",
              background: "#000",
            }}
          />
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  padding: "12px 20px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
};

export default App;