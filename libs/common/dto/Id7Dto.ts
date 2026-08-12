import { IsUUID } from 'class-validator';

export class Id7Dto {
  @IsUUID('7', {
    message: 'id must be a valid UUID',
  })
  id!: string;
}
