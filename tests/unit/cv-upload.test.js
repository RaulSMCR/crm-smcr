import { describe, expect, it } from "vitest";
import {
  buildPendingCvPath,
  CV_PENDING_PREFIX,
  getCvStoragePathFromPublicUrl,
  getExtensionFromPendingCvPath,
  isPendingCvPath,
  normalizeCvUploadId,
} from "@/lib/cv-upload";

const VALID_UPLOAD_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("cv-upload helpers", () => {
  it("accepts only UUID v4 values as public upload IDs", () => {
    expect(normalizeCvUploadId(VALID_UPLOAD_ID.toUpperCase())).toBe(VALID_UPLOAD_ID);
    expect(normalizeCvUploadId("clx123user")).toBeNull();
    expect(normalizeCvUploadId("../clx123user")).toBeNull();
  });

  it("builds pending CV paths under the reserved registration prefix", () => {
    expect(buildPendingCvPath(VALID_UPLOAD_ID, "application/pdf")).toBe(
      `${CV_PENDING_PREFIX}/${VALID_UPLOAD_ID}/cv.pdf`
    );

    expect(
      buildPendingCvPath(VALID_UPLOAD_ID, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).toBe(`${CV_PENDING_PREFIX}/${VALID_UPLOAD_ID}/cv.docx`);
    expect(buildPendingCvPath("clx123user", "application/pdf")).toBeNull();
    expect(buildPendingCvPath(VALID_UPLOAD_ID, "image/png")).toBeNull();
  });

  it("recognizes only pending CV paths from public URLs", () => {
    const pendingUrl = `https://project.supabase.co/storage/v1/object/public/CVS/${CV_PENDING_PREFIX}/${VALID_UPLOAD_ID}/cv.pdf`;
    const finalUserUrl = "https://project.supabase.co/storage/v1/object/public/CVS/clx123user/cv.pdf";

    const pendingPath = getCvStoragePathFromPublicUrl(pendingUrl);
    expect(pendingPath).toBe(`${CV_PENDING_PREFIX}/${VALID_UPLOAD_ID}/cv.pdf`);
    expect(getCvStoragePathFromPublicUrl(pendingUrl, "https://project.supabase.co")).toBe(pendingPath);
    expect(getCvStoragePathFromPublicUrl(pendingUrl, "https://other.supabase.co")).toBeNull();
    expect(isPendingCvPath(pendingPath)).toBe(true);
    expect(getExtensionFromPendingCvPath(pendingPath)).toBe("pdf");

    expect(isPendingCvPath(getCvStoragePathFromPublicUrl(finalUserUrl))).toBe(false);
    expect(getCvStoragePathFromPublicUrl("https://example.com/cv.pdf")).toBeNull();
  });
});
