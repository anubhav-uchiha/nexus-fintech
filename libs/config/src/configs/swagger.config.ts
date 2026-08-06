import { registerAs } from '@nestjs/config';
import { CONFIG_NAMESPACE } from '../constants/config.constants';

export default registerAs(CONFIG_NAMESPACE.SWAGGER, () => ({
  enabled: process.env.SWAGGER_ENABLED === 'true',
}));
