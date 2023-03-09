import { ApolloServer, UserInputError, gql } from "apollo-server";
import "./db.js";
import Person from "./models/person.js";
import User from "./models/user.js";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
dotenv.config();

// const typeDefs = gql`
const typeDefinitions = gql`
  enum YesNo {
    YES
    NO
  }

  type Address {
    street: String!
    city: String!
  }

  type Person {
    name: String!
    phone: String
    address: Address!
    id: ID!
  }

  type User {
    username: String!
    friends: [Person!]!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Query {
    personCount: Int!
    allPersons(phone: YesNo): [Person!]!
    findPerson(name: String!): Person
    me: User
  }

  type Mutation {
    addPerson(
      name: String!
      phone: String
      street: String!
      city: String!
    ): Person
    editNumber(name: String!, phone: String!): Person
    createUser(username: String!): User
    login(username: String!, password: String!): Token
    addAsFriend(name: String!): User
  }
`;

const resolvers = {
  Query: {
    // personCount: () => persons.length,
    personCount: () => Person.collection.countDocuments(), //numero de documentos en la coleccion
    allPersons: async (root, args) => {
      if (!args.phone) return Person.find({});
      return Person.find({ phone: { $exists: args.phone === "YES" } }); //$exists es un operador de mongodb que nos permite buscar por si existe o no un campo en la coleccion. Si args.phone es YES, devolvemos el phone, si no, devolvemos !phone. args.phone===YES es un booleano, por lo que si es true, devolvemos el phone, si es false, devolvemos !phone. y !phone
    },
    // allPersons: async (root, args) => {
    //   // const { data: personsFromRestApi } = await axios.get(
    //   //   "http://localhost:3000/persons"
    //   // );
    //   // console.log(personsFromRestApi);

    //   //no olvidar que el phone es opcional en el type person pero tbm es opcional en el query allPersons(phone: YesNo ---> aqui no esta el !), por lo que hay que comprobar si existe o no
    //   if (!args.phone) {
    //     return persons; //como en la query le pasamos por parametro el phone... si no existe este parametro, devolvemos todos los persons.
    //     // return personsFromRestApi; // aqui modificamos despues para usar los apis
    //   }

    //   return personsFromRestApi.filter((person) => {
    //     return args.phone === "YES" ? person.phone : !person.phone;
    //   }); // aqui modificamos despues para usar los apis

    //   // return persons.filter((person) => {
    //   //   return args.phone === "YES" ? person.phone : !person.phone;
    //   // }); //este es el mismo codigo que el de abajo, pero en una sola linea. Si el parametro phone es YES, devolvemos el person.phone, si no, devolvemos !person.phone

    //   // const byPhone = (person) =>
    //   //   args.phone === "YES" ? person.phone : !person.phone;
    //   // return persons.filter(byPhone);
    // },
    findPerson: async (root, args) => {
      const { name } = args;
      return Person.findOne({ name });
    },
    //   findPerson: async (root, args) => {
    //     // const { data: personsFromRestApi } = await axios.get(
    //     //   "http://localhost:3000/persons"
    //     // );
    //     const { name } = args;
    //     return persons.find((p) => p.name === name);
    //     // return personsFromRestApi.find((p) => p.name === name);
    //   }, //root es el objeto que contiene los datos de la consulta
    //   //args es el objeto que contiene los argumentos de la consulta
    // },
    me: (root, args, context) => {
      return context.currentUser;
    },
  },
  Mutation: {
    addPerson: async (root, args, context) => {
      const { currentUser } = context;
      if (!currentUser) throw new AuthenticationError("not authenticated");
      const person = new Person({ ...args });
      try {
        await person.save(); //si pasaramos un name donde tiene 2 caracteres, nos devolveria un error, ya que en el modelo person, hemos definido que el name debe tener minimo 5 caracteres. esto es gracias a mongoose y no a graphql que lo dejaria pasar.
        currentUser.friends = currentUser.friends.concat(person);
        await currentUser.save();
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }

      return person;
    },
    // addPerson: (root, args) => {
    //   if (persons.find((p) => p.name === args.name)) {
    //     throw new UserInputError("Name must be unique", {
    //       invalidArgs: args.name,
    //     });
    //   }
    //   // const { name, phone, street, city } = args;
    //   const person = { ...args, id: uuid() };
    //   persons.push(person); //update database width new person
    //   return person;
    // },
    editNumber: async (root, args) => {
      const person = await Person.findOne({ name: args.name });
      if (!person) return null; //mejor esto que un error
      person.phone = args.phone;

      try {
        await person.save();
      } catch (error) {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      }

      return person;
    },
    // editNumber: (root, args) => {
    //   const personIndex = persons.findIndex((p) => p.name === args.name);
    //   if (personIndex === -1) {
    //     return null; //si no existe la persona, devolvemos null, siempre en graphql
    //   }
    //   const person = persons[personIndex];
    //   const updatedPerson = { ...person, phone: args.phone };
    //   persons[personIndex] = updatedPerson;
    //   return updatedPerson;
    // },
    createUser: (root, args) => {
      const user = new User({ username: args.username });

      return user.save().catch((error) => {
        throw new UserInputError(error.message, {
          invalidArgs: args,
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });
      if (!user || args.password !== "1234") {
        throw new UserInputError("wrong credentials");
      }
      const userForToken = {
        username: user.username,
        id: user._id,
      };
      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
    addAsFriend: async (root, args, { currentUser }) => {
      if (!currentUser) throw new AuthenticationError("not authenticated");
      const person = await Person.findOne({ name: args.name });
      const nonFriendAlready = (person) =>
        !currentUser.friends.map((f) => f._id).includes(person._id);
      console.log(currentUser.friends.map((f) => f._id));
      console.log(person._id);
      console.log(currentUser.friends.map((f) => f._id).includes(person._id));
      if (nonFriendAlready(person)) {
        console.log("amigo añadido");
        currentUser.friends = currentUser.friends.concat(person);
        await currentUser.save();
      }
      return currentUser;
    },
  },
  // Person: {
  //   name: (root) => root.name,
  //   phone: (root) => root.phone,
  //   street: (root) => root.street,
  //   city: (root) => root.city,
  //   id: (root) => root.id,
  // },
  // Person: {
  //   // canDrink: (root) => root.age >= 18,
  //   address: (root) => `${root.street}, ${root.city}`,
  //   // check: () => "midu",
  // },
  Person: {
    address: (root) => {
      return {
        street: root.street,
        city: root.city,
      };
    },
  },
};

//tbm podria hacerse de esta forma:
// const server = new ApolloServer({
//   typeDefs,
//   resolvers,
// });
const server = new ApolloServer({
  typeDefs: typeDefinitions,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const decodedToken = jwt.verify(
        auth.substring(7),
        process.env.JWT_SECRET
      ); //este decodedToken es el que hemos definido en el login oses el userForToken que tiene el username y el id
      const currentUser = await User.findById(decodedToken.id).populate(
        "friends"
      );
      return { currentUser };
    }
  },
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});

// const persons = [
//   {
//     name: "John",
//     phone: "1234567890",
//     street: "123 Main St",
//     city: "New York",
//     id: "1",
//   },
//   {
//     name: "Jane",
//     phone: "0987654321",
//     street: "456 Main St",
//     city: "Londres",
//     id: "2",
//   },
//   {
//     name: "Jack",
//     street: "123 Main St reacargaoo",
//     city: "Madrid",
//     id: "3",
//   },
// ];
