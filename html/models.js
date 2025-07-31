const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('workhours_db', 'hodder', 'romeo10', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false,
});

const WorkHour = sequelize.define('WorkHour', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    employee_id: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false },
    projects: { type: DataTypes.JSON, allowNull: false },
    hours_worked: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    location: { type: DataTypes.STRING, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    signature: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'WorkHours',
    timestamps: true,
});

module.exports = { sequelize, WorkHour };

