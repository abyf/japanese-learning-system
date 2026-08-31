# Credits & Attributions

## Stroke order data — KanjiVG

Stroke-order data for hiragana, katakana and kanji (in `content/kana/strokes.json`)
is derived from the **KanjiVG** project.

- Project: KanjiVG — https://kanjivg.tagaini.net/ (source: https://github.com/KanjiVG/kanjivg)
- Copyright: © Ulrich Apel and the KanjiVG contributors
- License: Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0) —
  https://creativecommons.org/licenses/by-sa/3.0/

The dataset shipped with this app is a trimmed extract (only the characters taught
in the app), containing the ordered stroke paths for each character. It is
regenerated with `node scripts/build-strokes.js`. As required by CC BY-SA 3.0,
any redistribution of this stroke data must keep this attribution and remain
under the same license.

## Pronunciation audio — Amazon Polly

The Japanese pronunciation clips in `content/audio/` are generated with
**Amazon Polly** neural voices (Takumi, Kazuha) by `scripts/build-audio.js`,
run once at build time. The app serves these bundled MP3s locally at runtime
(no network calls, no per-user cost). Audio synthesized with Amazon Polly may
be used and stored in accordance with the AWS Service Terms, including in
commercial products.

Regenerate/extend with:

    node scripts/build-audio.js            # generate missing clips
    node scripts/build-audio.js --force    # regenerate everything

If any character or word has no bundled clip, the app falls back to the
browser's built-in speech synthesizer automatically.
