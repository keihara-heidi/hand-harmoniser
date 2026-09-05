# Hand Harmoniser

Sing into a mic while your hands, tracked by the webcam, pick a chord. The app pitch-shifts your live voice onto the chord tones and mixes those harmony voices with the dry signal.

**[Download for macOS](https://keihara-heidi.github.io/hand-harmoniser/)** — Apple Silicon and Intel.

macOS will say the unsigned app is “damaged”. Drag it to Applications, then:

```sh
xattr -cr "/Applications/Hand Harmoniser.app"
```

Then open it. Needs camera and microphone.

## Run

```sh
bun install
bun run tauri dev
```

Needs a camera and a microphone. On first launch, macOS will ask for camera and microphone permission. If it never prompts, open **System Settings → Privacy & Security → Camera** and enable Hand Harmoniser (or the terminal you launched from). To reset a silent deny: `tccutil reset Camera`.

If `cargo` fails with “Unable to find libclang” (bindgen for signalsmith-stretch):

```sh
brew install llvm
export LIBCLANG_PATH="$(brew --prefix llvm)/lib"
```

The Rust dev profile builds the audio crates optimised (`opt-level = 3` for dependencies). Unoptimised signalsmith-stretch is about 10× slower and not usable live.

## Gestures

The webcam view is mirrored.

- **Left hand (chord):** extended finger count (0–5) plus palm/back of hand is the root — palm facing the camera is C–F, back of the hand is F#–B.
- **Right hand (expression):** extended finger count sets quality — 0 sus4, 1 maj, 2 min, 3 dom7, 4 min7, 5 maj7. Wrist height sets harmony volume — bottom of the frame is silent, 60% of frame height is full.

Show both hands to drive the chord and the mix. Lower the right hand to fade the harmonies.

## Mix

Settings sliders: Master, Dry, Harmony, Reverb mix, Reverb size. Values persist in localStorage.

## Stack

Tauri 2, React, Rust (cpal + signalsmith-stretch), MediaPipe Hand Landmarker.
