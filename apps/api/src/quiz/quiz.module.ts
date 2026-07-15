import { Module } from "@nestjs/common";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { TeachersModule } from "../teachers/teachers.module";
import { AiModule } from "../ai/ai.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

@Module({
  imports: [TeachersModule, AiModule, SubscriptionsModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
