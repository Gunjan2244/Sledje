import { Router } from 'express';
import userRoutes from '../../services/users/users.routes';
import productRoutes from '../../services/products/products.routes';
import orderRoutes from '../../services/orders/orders.routes';


const router = Router();


router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);


export default router;