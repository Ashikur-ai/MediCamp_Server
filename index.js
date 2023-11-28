const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bpilnp1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const campCollection = client.db("MediCamp").collection("camps");
        const userCollection = client.db("MediCamp").collection("users");
        const registeredCampCollection = client.db("MediCamp").collection("registeredCamp");

        // middlewares 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next(); 
            })
            // next();
        }

        // use verify organizer after verifyToken 
        const verifyOrganizer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isOrganizer = user?.role === 'organizer';
            if (!isOrganizer) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // jwt related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            });
            res.send({ token });
        })

        // users related api 
        app.get('/users', verifyToken, verifyOrganizer, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.delete('/users/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/users/organizer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({message: 'forbidden access'})
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let organizer = false;
            if (user) {
                organizer = user?.role === 'organizer';
            }
            res.send({ organizer });
        })

        app.get('/users/professional/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let professional = false;
            if (user) {
                professional = user?.role === 'professional';
            }
            res.send({ professional });
        })

        app.patch('/users/organizer/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role:'organizer'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        app.patch('/users/professional/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'professional'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({message: 'user already exists', insertedId: null})
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })

        // profile updates 
        app.get('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        })

        app.patch('/updateProfile', async (req, res) => {
            const data = req.body;
            const filter = { email: data.email };
            const updatedDoc = {
                $set: {
                    name: data?.name,
                    phone: data?.phone,
                    address: data?.address
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // camp related api 
        
        app.get('/camps', async (req, res) => {
            const result = await campCollection.find().toArray();
            res.send(result);
        })

        app.post('/camps', verifyToken, verifyOrganizer, async (req, res) => {
            const data = req.body;
            const result = await campCollection.insertOne(data);
            res.send(result);
        })

        app.delete('/delete-camp/:campId', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) }
            const result = await campCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/update-camp/:campId', async (req, res) => {
            const id = req.params.campId;
            const query = { _id: new ObjectId(id) };
            const result = await campCollection.findOne(query);
            res.send(result);
        })

        app.patch('/update-camp/:campId', async (req, res) => {
            const data = req.body;
            const id = req.params.campId;
            
            const filter = { _id: new ObjectId(id) };
            
            const updatedDoc = {
                $set: {
                    audience: data?.audience,
                    camp_name: data?.camp_name,
                    description: data?.description,
                    fee: data?.fee,
                    image: data?.image,
                    professional: data?.professional,
                    schedule: data?.schedule,
                    service: data?.service,
                    venue: data?.venue
                }
            }

            const result = await campCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // registered camp api 
        app.post('/registeredCamp', async (req, res) => {
            const data = req.body;
            const query = {
                camp_id: data.camp_id,
                email: data.email
            };
            const alreadyRegistered = await registeredCampCollection.findOne(query);
            if (alreadyRegistered) {
                return res.send({message: 'user already exists', insertedId: null})
            }
            const result = await registeredCampCollection.insertOne(data);
            res.send(result);
        })

        app.get('/registeredCamp/:email', async (req, res) => {
            const email = req.params.email;
            const query = {
                email: email
            }
            const result = await registeredCampCollection.find(query).toArray();
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('medicamp is running')
})

app.listen(port, () => {
    console.log(`Medicamp is running on port ${port}`);
})