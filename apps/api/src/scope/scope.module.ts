import { Global, Module } from "@nestjs/common";
import { ScopeService } from "./scope.service";

/**
 * Global for the same reason the permissions module is: "what may this person
 * do" and "to whom may they do it" are asked together, and every module that
 * asks the first needs the second from the same place.
 */
@Global()
@Module({
  providers: [ScopeService],
  exports: [ScopeService],
})
export class ScopeModule {}
