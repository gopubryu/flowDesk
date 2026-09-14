import { createHash, randomBytes } from "node:crypto";
import { WorkspaceRole } from "@prisma/client";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function isValidInvitationRole(value: unknown): value is WorkspaceRole {
  return value === WorkspaceRole.ADMIN || value === WorkspaceRole.OPERATOR || value === WorkspaceRole.VIEWER;
}

export function canInviteRole(
  inviterRole: WorkspaceRole,
  recipientRole: unknown,
): recipientRole is WorkspaceRole {
  return (
    inviterRole === WorkspaceRole.ADMIN &&
    isValidInvitationRole(recipientRole)
  );
}

export function validateInvitationExpiry(
  value: unknown,
  now = new Date(),
): Date | null {
  const expiry = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return null;
  const remaining = expiry.getTime() - now.getTime();
  return remaining > 0 && remaining <= MAX_INVITATION_TTL_MS ? expiry : null;
}

export function isInvitationExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function createInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidInvitationToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function isInvitationEmailMatch(
  invitationEmail: unknown,
  sessionEmail: unknown,
): boolean {
  const normalizedInvitationEmail = normalizeInvitationEmail(invitationEmail);
  const normalizedSessionEmail = normalizeInvitationEmail(sessionEmail);
  return Boolean(
    normalizedInvitationEmail &&
      normalizedSessionEmail &&
      normalizedInvitationEmail === normalizedSessionEmail,
  );
}

export function isInvitationEligible(
  invitation: Pick<{ acceptedAt: Date | null; expiresAt: Date }, "acceptedAt" | "expiresAt">,
  now = new Date(),
): boolean {
  return invitation.acceptedAt === null && !isInvitationExpired(invitation.expiresAt, now);
}
