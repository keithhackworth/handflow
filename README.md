# HandFlow

> **Work in progress — very early development. The public API and behavior will change.**

In other words, this is not the droid you are looking for...

HandFlow will be a temporal tracking, identity, confidence, repair, and normalization layer for noisy landmark streams.

Landmark detectors such as MediaPipe are very good at detecting what they can see in an individual frame, but real-world temporal data can be messy. Hand identity can temporarily flip, landmarks can disappear, hands can cross or overlap, and detector confidence does not necessarily represent confidence in a tracked object over time.

HandFlow is intended to sit between a landmark detector and the application consuming its output.

```text
video / camera
      ↓
landmark detector
      ↓
   HandFlow
      ↓
clean temporal landmark stream
      ↓
your application
```

## Goals

HandFlow is being designed to provide:

* Persistent anatomical hand identity across frames
* Temporal continuity and tracking
* Confidence derived from multiple sources of evidence
* Short-gap landmark prediction and repair
* Explicit provenance for observed, predicted, interpolated, and missing landmarks
* Hand-to-person association
* Anatomical normalization
* Configurable buffering for live streams
* Detector-independent processing

MediaPipe will be the first supported detector, but HandFlow's core architecture is intended to remain detector-independent.

## Why?

A detector might report:

```text
Frame 1: Left + Right
Frame 2: Left + Left
Frame 3: Left + Right
```

That does not necessarily mean the physical hands changed identity.

Similarly, a fingertip disappearing for a single frame does not necessarily mean its location is completely unknown.

HandFlow aims to use temporal and anatomical evidence to produce a more stable representation while preserving uncertainty rather than hiding it.

## Status

**Pre-alpha / active development.**

The project currently contains the initial TypeScript package structure and public data contracts. Tracking, identity resolution, prediction, normalization, detector adapters, and other core functionality are still under development.

Do not depend on the current API remaining stable.

## Intended uses

Potential applications include:

* Sign language and gesture recognition
* Human-computer interaction
* AR/VR
* Robotics
* Motion analysis
* Computer vision research
* Other systems consuming temporal landmark data

## Philosophy

HandFlow is intended to remain simple to understand and integrate.

The project favors straightforward code, explicit contracts, and practical abstractions over unnecessary architectural complexity.

## License

HandFlow is open source under the **Mozilla Public License 2.0 (MPL-2.0)**.

Commercial and proprietary use is welcome. Modifications to MPL-covered HandFlow source files remain subject to the MPL-2.0 license.

Contributions and upstream bug fixes are encouraged.

## Support

If HandFlow eventually saves you some time or helps your project, and you'd like to support its continued development, feel free to buy me a coffee.

Totally optional — using the library is support enough.


