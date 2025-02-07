const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
        // await client.connect();

        const campCollection = client.db("MediCamp").collection("camps");
        const userCollection = client.db("MediCamp").collection("users");
        const registeredCampCollection = client.db("MediCamp").collection("registeredCamp");
        const reviewCollection = client.db("MediCamp").collection("reviews");
        const upcomingCampCollection = client.db("MediCamp").collection("upcoming_camp");
        const interestedProfessionalCollection = client.db("MediCamp").collection("interested_professional");
        const interestedParticipantCollection = client.db("MediCamp").collection("interested_participant");

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
        app.get('/users', verifyToken,  async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.delete('/users/:id', verifyToken,  async (req, res) => {
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

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.patch('/users/organizer/:id', verifyToken, async (req, res) => {
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


        app.patch('/users/professional/:id', verifyToken, async (req, res) => {
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

        // payment api for registered camp
        app.get('/registeredCamp', async (req, res) => {
            // const id = req.params.campId;
            // const query = { _id: new ObjectId(id) }
            const result = await registeredCampCollection.find().toArray();
            res.send(result);
        })

        app.get('/registerCamp/:id', async (req, res) => {
            const id = req.params.id;
            
            const query = { _id: new ObjectId(id) };
            const result = await registeredCampCollection.findOne(query);
            res.send(result);
        })

        app.patch('/payment-camp/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    payment: 'done'
                }
            }
            const result = await registeredCampCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        
        app.delete('/delete-registered-camp/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await registeredCampCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/confirm-camp/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    confirm: 'done'
                }
            }
            const result = await registeredCampCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.get('/paidCamp/:email', async (req, res) => {
            const email = req.params.email;
            const query = {
                email: email,
                payment: "done"
            }
            const result = await registeredCampCollection.find(query).toArray();
            res.send(result);
        })

        // reviews api 
        app.post('/reviews', async (req, res) => {
            const data = req.body;
            const result = await reviewCollection.insertOne(data);
            res.send(result);
        })

        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


        // upcoming camp api 
        app.post('/upcomingCamp', async (req, res) => {
            const data = req.body;
            const result = await upcomingCampCollection.insertOne(data);
            res.send(result);
        })

        app.get('/upcomingCamp', async (req, res) => {
            const result = await upcomingCampCollection.find().toArray();
            res.send(result);
        })

        app.get('/upcomingCamp/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await upcomingCampCollection.findOne(query);
            res.send(result);
        })

        // interested professional api 
        app.post('/interestedProfessional', async (req, res) => {
            const data = req.body;
            const query = {
                camp_id: data.camp_id,
                email: data.email
            }

            const alreadyInterested = await interestedProfessionalCollection.findOne(query);

            if (alreadyInterested) {
                return res.send({message: 'already inserted', insertedId: null})
            }
            const result = await interestedProfessionalCollection.insertOne(data);
            res.send(result);
        })

        // count interested professional

        app.get('/countProfessional/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                camp_id: id
            }
            const result = await interestedProfessionalCollection.find(query).toArray();
            res.send(result);
        })

        // interested participant api 
        app.post('/interestedParticipant', async (req, res) => {
            const data = req.body;
            const query = {
                camp_id: data.camp_id,
                email: data.email
            }

            const alreadyInterested = await interestedParticipantCollection.findOne(query);
            if (alreadyInterested) {
                return res.send({ message: 'already inserted', insertedId: null })
            }

            const result = await interestedParticipantCollection.insertOne(data);
            res.send(result);
        })

        // count interested participant 
        app.get('/countParticipant/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                camp_id: id
            }
            const result = await interestedParticipantCollection.find(query).toArray();
            res.send(result);
        })

        // delete upcoming camps 
        app.delete('/delete-upcoming/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await upcomingCampCollection.deleteOne(query);
            res.send(result);
        })

        // organizer accepted campaign 
        app.get('/acceptedCamp/:email', async (req, res) => {
            const email = req.params.email;
            const query = {
                email : email
            }
            const result = await interestedProfessionalCollection.findOne(query);

            const query1 = {
                _id : new ObjectId(result.camp_id)
            }
            const result1 = await upcomingCampCollection.find(query1).toArray();

            res.send(result1);
        })

        // update accept participant upcomming camp 
        app.patch('/accept-participants/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    participants: 'accepted'
                }
            }
            const result = await upcomingCampCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        

        // update accept professional upcomming camp 
        app.patch('/accept-professionals/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    professionals: 'accepted'
                }
            }
            const result = await upcomingCampCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        // publish upcomming camp 
        app.patch('/publish-upcoming/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    publish: 'done'
                }
            }
            const result = await upcomingCampCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // update upcoming camp

        app.patch('/update-upcoming-camp/:campId', async (req, res) => {
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

            const result = await upcomingCampCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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