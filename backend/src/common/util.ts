import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** 서비스 기준 날짜(Asia/Seoul) YYYY-MM-DD */
export function seoulDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 이번 주 월요일(서울) */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** 모든 오류를 { statusCode, message, code } 형태로 통일한다. Prisma 오류는 내부 내용을 숨긴다. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Error');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (res.headersSent) return;
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as any).message;
      return res.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        message: Array.isArray(message) ? message[0] : message,
        code: (body as any).code,
      });
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return res.status(404).json({ statusCode: 404, message: '찾을 수 없어요' });
      if (exception.code === 'P2002') return res.status(409).json({ statusCode: 409, message: '이미 있어요' });
    }
    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: '잠시 문제가 생겼어요. 다시 시도해 주세요' });
  }
}
