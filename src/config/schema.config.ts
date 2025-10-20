import { Schema, SchemaOptions } from 'mongoose';
import { formatDateTime } from 'src/utils/date';

type TimestampDocument = {
  createdAt?: Date | string | number;
  updatedAt?: Date | string | number;
};

export const GlobalSchema: SchemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function (_doc, ret: Record<string, unknown>) {
      delete ret._id;
      return ret;
    },
  },
  toObject: { virtuals: true },
};

export function globalTimePlugin(schema: Schema) {
  schema.add({
    createdAt: { type: Date, select: false },
    updatedAt: { type: Date, select: false },
  });

  schema.virtual('createdTime').get(function (this: TimestampDocument) {
    return this.createdAt ? formatDateTime(this.createdAt) : undefined;
  });

  schema.virtual('updatedTime').get(function (this: TimestampDocument) {
    return this.updatedAt ? formatDateTime(this.updatedAt) : undefined;
  });
}
