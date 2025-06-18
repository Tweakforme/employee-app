-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: workhours_db
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `dob` date DEFAULT NULL,
  PRIMARY KEY (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES ('csakaki','$2b$10$GMuK7f9WR7EzE0rZot3xR.UFEuQmV1vL/u6HahG2Qx13GmZDohQDq',NULL),('drobertson','$2b$10$qReAe4WWgXPPwPA407blBeKif/CiQLvJxR1H7k1.TFAK4iNWT4Uyq',NULL),('dwayneh','$2b$10$rTeYYhm6Q9qMwtHuUw3kjOiowJTdBCRUiXPyq6etwG.XZWv73IuV.',NULL),('jfrancis','$2b$10$xVfy69fg39.fydj0DT7Mv.J8UqBl6rcc97sCzXCdgEhfelHzd99Va',NULL),('kenziesh','$2b$10$qhW2Ug5cWsG9VGfGjHNkUOWFSLUVsgET/f.hvDg6ASY2.hVx21QSu',NULL),('mfricker','$2b$10$IYisoOvLNjRFHSxyKAXFCulErBRQIq.cbg1aM8wyhHGNbVjUi8yGC',NULL),('mhodder','$2b$10$4HdiaZ7b1h5aMg.dpTm5jOu7Pt5z2QAtNflN./wZj0JKWRB.7RQZC',NULL),('test','$2b$10$Wd1aVTL5LS3BMhi/AQ8Sw.F99dh4wtzDFqpyAc5K6X35cyaMMLTcS','2000-01-01');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workhours`
--

DROP TABLE IF EXISTS `workhours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workhours` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(255) NOT NULL,
  `date` datetime NOT NULL,
  `hours_worked` float NOT NULL,
  `description` text,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `location` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workhours`
--

LOCK TABLES `workhours` WRITE;
/*!40000 ALTER TABLE `workhours` DISABLE KEYS */;
INSERT INTO `workhours` VALUES (9,'csakaki','2025-02-08 00:00:00',5,'fixed shower head','2025-02-04 18:45:35','2025-02-04 18:45:35','222 home dr');
/*!40000 ALTER TABLE `workhours` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-02-04 14:34:46
