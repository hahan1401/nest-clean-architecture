export class User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: Partial<User>) {
    Object.assign(this, props);
  }
}
