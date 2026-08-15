import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ExaminationsModule } from "../examinations/examinations.module";
import { FinanceModule } from "../finance/finance.module";
import { TimetableModule } from "../timetable/timetable.module";
import { QuizModule } from "../quiz/quiz.module";
import { StudentPortalController } from "./student-portal.controller";
import { StudentPortalService } from "./student-portal.service";

@Module({
  imports: [
    ExaminationsModule,
    FinanceModule,
    TimetableModule,
    QuizModule,
    // Same secret as AuthModule's JwtModule (own instance, not exported from
    // there) so tokens this module signs verify under the global
    // JwtAuthGuard — same pattern LibraryPortalModule uses.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [StudentPortalController],
  providers: [StudentPortalService],
})
export class StudentPortalModule {}
