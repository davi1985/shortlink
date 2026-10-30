import {
  BadRequestException,
  Injectable,
  type PipeTransform,
  type ArgumentMetadata,
} from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    void metadata;

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const fields = result.error.issues.reduce<Record<string, string>>(
        (accumulator, { path, message }) => {
          const key = path.length > 0 ? String(path.join('.')) : 'value';
          accumulator[key] = message;

          return accumulator;
        },
        {},
      );

      throw new BadRequestException({
        error: {
          code: 'INVALID_URL',
          message: 'Validation failed.',
          fields,
        },
      });
    }

    return result.data;
  }
}
