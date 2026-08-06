import { registerAs } from '@nestjs/config';
import { CONFIG_NAMESPACE } from '../constants/config.constants';

export default registerAs(CONFIG_NAMESPACE.REDIS, () => ({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
}));
