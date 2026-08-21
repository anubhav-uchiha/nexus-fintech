import { Module } from '@nestjs/common';
import { EkoService } from './eko.service';
import { EkoKafkaController } from './eko.kafka.controller';
import { EkoClientService } from './eko-client.service';
import { HttpToRpcExceptionInterceptor } from '../../common/interceptors/http-to-rpc-exception.interceptor';
import { AepsMerchantProfileModule } from '../../merchant-profile/aeps-merchant-profile.module';

@Module({
  imports: [AepsMerchantProfileModule],
  controllers: [EkoKafkaController],
  providers: [EkoClientService, EkoService, HttpToRpcExceptionInterceptor],
  exports: [EkoService],
})
export class EkoServiceModule {}
