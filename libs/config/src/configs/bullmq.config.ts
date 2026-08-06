import { registerAs } from '@nestjs/config';
import { CONFIG_NAMESPACE } from '../constants/config.constants';

export default registerAs(CONFIG_NAMESPACE.BULLMQ, () => ({
  prefix: process.env.BULLMQ_PREFIX,
}));
