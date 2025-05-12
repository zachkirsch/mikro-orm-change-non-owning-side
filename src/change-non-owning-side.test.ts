import {
  Entity,
  MikroORM,
  OneToOne,
  Opt,
  PrimaryKey,
  ref,
  Ref,
} from "@mikro-orm/sqlite";

@Entity()
class User {
  @PrimaryKey()
  id!: string;

  @OneToOne(() => Pet, (pet) => pet.owner, { ref: true, nullable: true })
  pet!: Opt<Ref<Pet>> | null;
}

@Entity()
class Pet {
  @PrimaryKey()
  id!: string;

  @OneToOne(() => User, (person) => person.pet, {
    owner: true,
    ref: true,
    nullable: true,
  })
  owner!: Opt<Ref<User>> | null;
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [User, Pet],
    debug: ["query", "query-params"],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

// this passes
test("can re-assign to owning side of OneToOne relationship", async () => {
  orm.em.create(Pet, {
    id: "pet-0",
    owner: orm.em.create(User, { id: "user-0" }),
  });
  await orm.em.flush();
  orm.em.clear();

  const pet = await orm.em.findOneOrFail(Pet, { id: "pet-0" });
  pet.owner = ref(orm.em.create(User, { id: "user-1" }));

  await orm.em.flush();
});

// this fails
test("can re-assign to non-owning side of OneToOne relationship", async () => {
  orm.em.create(User, {
    id: "user-0",
    pet: orm.em.create(Pet, { id: "pet-0" }),
  });
  await orm.em.flush();
  orm.em.clear();

  const user = await orm.em.findOneOrFail(User, { id: "user-0" });
  user.pet = ref(orm.em.create(Pet, { id: "pet-1" }));

  // UniqueConstraintViolationException:
  // insert into `pet` (`id`, `owner_id`) values ('pet-1', 'user-0')
  // - SQLITE_CONSTRAINT: UNIQUE constraint failed: pet.owner_id
  await orm.em.flush();
});
