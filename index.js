require('dotenv').config()
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const express = require("express");
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json())



// verify token
const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
    }

    const token = req.headers.authorization.split(' ')[1]

    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    else {
        jwt.verify(token, process.env.JWT_SECRET_KEY, function (err, decoded) {
            if (err) {
                return res.status(401).send({ message: "unauthorized access" });
            }
            req.decoded = decoded;
            next();
        })
    }
};


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xt5rphe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {

    const bistroBossUser = client.db("bistroDB").collection("users");
    const bistroBossMenu = client.db("bistroDB").collection("menu");
    const bistroBossReviews = client.db("bistroDB").collection("reviews");
    const bistroBossCarts = client.db("bistroDB").collection("carts");
    const bistroBossPayment = client.db("bistroDB").collection("payments");

    try {


        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await bistroBossUser.findOne(query);
            const isAdmin = user?.role === 'Admin'
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // create jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET_KEY, { expiresIn: '12h' })
            res.send({ token })
        })

        // store user info
        app.post('/users', async (req, res) => {
            const userInfo = req.body;
            const email = userInfo.email;
            const query = { email: email }
            const existingUser = await bistroBossUser.findOne(query)
            if (existingUser) {
                res.send({ message: "user already exist", insertedId: null })
                return;
            }
            const result = await bistroBossUser.insertOne(userInfo);
            res.send(result);
        })

        // read all users
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await bistroBossUser.find().toArray()
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email };
            const user = await bistroBossUser.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'Admin';
            }
            res.send({ admin })
        })

        app.delete('/delete/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bistroBossUser.deleteOne(query);
            res.send(result);
        })

        // api for change user role
        app.patch('/user/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await bistroBossUser.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // read all menu data
        app.get('/menu', async (req, res) => {
            const result = await bistroBossMenu.find().toArray();
            res.send(result)
        })

        // read single menu item
        app.get('/menu/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bistroBossMenu.findOne(query);
            res.send(result)
        })

        // update single menu item
        app.patch('/menu/update/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: updatedData.name,
                    recipe: updatedData.recipe,
                    image: updatedData.image,
                    category: updatedData.category,
                    price: updatedData.price,
                }
            };
            const result = await bistroBossMenu.updateOne(query, updatedDoc);
            res.send(result);
        })

        // add menu item to db
        app.post('/addMenuItem', async (req, res) => {
            const item = req.body;
            const result = await bistroBossMenu.insertOne(item);
            res.send(result);
        })

        // delete menu item
        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bistroBossMenu.deleteOne(query);
            res.send(result);
        })

        // read all reviews data
        app.get('/reviews', async (req, res) => {
            const result = await bistroBossReviews.find().toArray();
            res.send(result);
        })

        // store cart data to db
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            console.log(cartItem)
            const result = await bistroBossCarts.insertOne(cartItem);
            res.send(result);
        })

        // read carts data
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await bistroBossCarts.find(query).toArray();
            res.send(result);
        })

        // delete single data from carts
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bistroBossCarts.deleteOne(query);
            res.send(result);
        })


        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const users = await bistroBossUser.estimatedDocumentCount();
            const menuItems = await bistroBossMenu.estimatedDocumentCount();
            const orders = await bistroBossPayment.estimatedDocumentCount();
            const revenue = await bistroBossPayment.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: "$price" }
                    }
                }
            ]).toArray();
            const sumOfRevenue = revenue.length > 0 ? revenue[0].totalRevenue : 0

            res.send({
                users,
                menuItems,
                orders,
                sumOfRevenue
            })
        })


        app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
            const result = await bistroBossPayment.aggregate([
                {
                    $addFields: {
                        menuItemObjectIds: {
                            $map: {
                                input: "$menuItemIds",
                                as: "id",
                                in: { $toObjectId: "$$id" }
                            }
                        }
                    }
                },

                {
                    // $unwind: "$menuItemIds"
                    $unwind: "$menuItemObjectIds"
                },
                {
                    $lookup:
                    {
                        from: "menu",
                        localField: "menuItemObjectIds",
                        foreignField: "_id",
                        as: "menuItems"
                    }
                },
                {
                    $unwind: "$menuItems"
                },
                {
                    $group: {
                        _id: "$menuItems.category",
                        quantity: { $sum: 1 },
                        revenue: { $sum: "$menuItems.price" }
                    }
                },
                {
                    $project:
                    {
                        _id: 0,
                        category: "$_id",
                        quantity: "$quantity",
                        revenue: "$revenue"

                    }
                }
            ]).toArray();


            res.send(result)
        })



        // payment
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ["card"]
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        })

        app.get("/payment/:email", verifyToken, async (req, res) => {
            const query = { email: req.params.email };
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const result = await bistroBossPayment.find(query).toArray();
            res.send(result);
        })

        app.post('/payment', async (req, res) => {
            const paymentInfo = req.body;
            const paymentResult = await bistroBossPayment.insertOne(paymentInfo);

            // delete each item from the cart
            const query = {
                _id: {
                    $in: paymentInfo.cartIds.map(id => new ObjectId(id))
                }
            }
            const deletedResult = await bistroBossCarts.deleteMany(query);
            res.send({ paymentResult, deletedResult });
        })


        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
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
    res.send('bistro boss server running')
})

app.listen(port, () => {
    // console.log(`server running on port: ${port}`)
})