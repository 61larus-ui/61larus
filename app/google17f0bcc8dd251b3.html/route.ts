export async function GET() {
  return new Response("google-site-verification: google17f0bcc8dd251b3.html", {
    headers: { "content-type": "text/html" },
  });
}
