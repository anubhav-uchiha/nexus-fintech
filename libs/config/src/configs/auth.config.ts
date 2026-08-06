import { registerAs } from '@nestjs/config';
import { CONFIG_NAMESPACE } from '../constants/config.constants';

export default registerAs(CONFIG_NAMESPACE.AUTH, () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,

  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES,

  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES,
}));
