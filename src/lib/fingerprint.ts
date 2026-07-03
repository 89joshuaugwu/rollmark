import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cached: Promise<string> | null = null;

/**
 * The open-source community edition gives a visitorId derived from browser/
 * device characteristics. It's not a hard identity guarantee (a fresh
 * browser profile or incognito window can shift it), which is exactly why
 * the API route treats a match as a soft fraud *signal* to flag for the
 * lecturer's review, not a hard block.
 */
export async function getBrowserFingerprint(): Promise<string> {
  if (!cached) {
    cached = FingerprintJS.load().then(async (fp) => {
      const result = await fp.get();
      return result.visitorId;
    });
  }
  return cached;
}
