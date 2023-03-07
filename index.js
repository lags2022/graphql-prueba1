import { ApolloServer, UserInputError, gql } from "apollo-server";
import { v1 as uuid } from "uuid";
import axios from "axios";

const persons = [
  {
    name: "John",
    phone: "1234567890",
    street: "123 Main St",
    city: "New York",
    id: "1",
  },
  {
    name: "Jane",
    phone: "0987654321",
    street: "456 Main St",
    city: "Londres",
    id: "2",
  },
  {
    name: "Jack",
    street: "123 Main St reacargaoo",
    city: "Madrid",
    id: "3",
  },
];

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
    street: String!
    address: Address!
    id: ID!
  }

  type Query {
    personCount: Int!
    allPersons(phone: YesNo): [Person!]!
    findPerson(name: String!): Person
  }

  type Mutation {
    addPerson(
      name: String!
      phone: String
      street: String!
      city: String!
    ): Person
    editNumber(name: String!, phone: String!): Person
  }
`;

const resolvers = {
  Query: {
    personCount: () => persons.length,
    allPersons: async (root, args) => {
      const { data: personsFromRestApi } = await axios.get(
        "http://localhost:3000/persons"
      );
      console.log(personsFromRestApi);

      //no olvidar que el phone es opcional en el type person pero tbm es opcional en el query allPersons(phone: YesNo ---> aqui no esta el !), por lo que hay que comprobar si existe o no
      if (!args.phone) {
        // return persons; //como en la query le pasamos por parametro el phone... si no existe este parametro, devolvemos todos los persons.
        return personsFromRestApi; // aqui modificamos despues para usar los apis
      }

      return personsFromRestApi.filter((person) => {
        return args.phone === "YES" ? person.phone : !person.phone;
      }); // aqui modificamos despues para usar los apis

      // return persons.filter((person) => {
      //   return args.phone === "YES" ? person.phone : !person.phone;
      // }); //este es el mismo codigo que el de abajo, pero en una sola linea. Si el parametro phone es YES, devolvemos el person.phone, si no, devolvemos !person.phone

      // const byPhone = (person) =>
      //   args.phone === "YES" ? person.phone : !person.phone;
      // return persons.filter(byPhone);
    },
    findPerson: async (root, args) => {
      const { data: personsFromRestApi } = await axios.get(
        "http://localhost:3000/persons"
      );
      const { name } = args;
      // return persons.find((p) => p.name === name);
      return personsFromRestApi.find((p) => p.name === name);
    }, //root es el objeto que contiene los datos de la consulta
    //args es el objeto que contiene los argumentos de la consulta
  },

  Mutation: {
    addPerson: (root, args) => {
      if (persons.find((p) => p.name === args.name)) {
        throw new UserInputError("Name must be unique", {
          invalidArgs: args.name,
        });
      }
      // const { name, phone, street, city } = args;
      const person = { ...args, id: uuid() };
      persons.push(person); //update database width new person
      return person;
    },
    editNumber: (root, args) => {
      const personIndex = persons.findIndex((p) => p.name === args.name);
      if (personIndex === -1) {
        return null; //si no existe la persona, devolvemos null, siempre en graphql
      }
      const person = persons[personIndex];
      const updatedPerson = { ...person, phone: args.phone };
      persons[personIndex] = updatedPerson;
      return updatedPerson;
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
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
