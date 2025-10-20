import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { GlobalSchema, globalTimePlugin } from 'src/config/schema.config';
import { Role } from 'src/common/interfaces/common.interface';

export type UserDocument = HydratedDocument<User>;

@Schema(GlobalSchema)
export class User {
  id: string;

  @Prop({ required: true, unique: true })
  account: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.USER })
  role: Role;

  @Prop({ default: false, select: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

globalTimePlugin(UserSchema);
