import { User } from "@app/database";

export interface UpdateLocationUseCase {
  execute(userId: string, latitude: number, longitude: number): Promise<User>;
}