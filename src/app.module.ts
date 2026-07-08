import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module';
import { UserModule } from './presentation/modules/user.module';

@Module({
  imports: [DatabaseModule, UserModule],
})
export class AppModule {}
