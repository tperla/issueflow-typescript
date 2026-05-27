import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinColumn,
  JoinTable, CreateDateColumn, UpdateDateColumn, VersionColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { User } from './user.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticketId: number;

  @ManyToOne(() => Ticket)
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @Column()
  authorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column('text')
  content: string;

  @ManyToMany(() => User)
  @JoinTable({ name: 'comment_mentioned_users' })
  mentionedUsers: User[];

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
