import { authorize } from '@/lib/http/guard';
import { getJob } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'read', { auth: false });
  if (blocked) return blocked;
  const { id } = await context.params;
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        const job = getJob(id);
        if (!job) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Job not found' })}\n\n`));
          clearInterval(timer);
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(timer);
          controller.close();
        }
      };
      send();
      timer = setInterval(send, 700);
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
