import { WALLY_PHOTO_JPEG } from "@/lib/wally-photo";

/**
 * Wally's contact card, sent with his first text so he shows up in the
 * person's phone with a name and a face. The name lives here and in copy
 * only, so it stays easy to change (see the product brief).
 */
export async function GET() {
  const number = process.env.NEXT_PUBLIC_WALLY_NUMBER?.trim();
  // vCard lines fold at 75 characters, continuing with a leading space.
  const photo = `PHOTO;ENCODING=b;TYPE=JPEG:${WALLY_PHOTO_JPEG}`.match(/.{1,74}/g)!.join("\r\n ");
  const card = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:;Wally;;;",
    "FN:Wally",
    "ORG:Wally the Waiter",
    "NOTE:Your AI waiter. Text me what you're hungry for.",
    ...(number ? [`TEL;TYPE=CELL:${number}`] : []),
    "URL:https://wallywaiter.com",
    photo,
    "END:VCARD",
    "",
  ].join("\r\n");
  return new Response(card, { headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": 'inline; filename="wally.vcf"', "Cache-Control": "public, max-age=3600" } });
}
