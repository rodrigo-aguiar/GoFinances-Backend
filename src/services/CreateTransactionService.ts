import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Category from '../models/Category';
import Transaction from '../models/Transaction';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    category: categoryTitle,
    type,
    value,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const balance = await transactionsRepository.getBalance();

    if (type === 'outcome' && balance.total < value) {
      throw new AppError(
        "You don't have enough money to complete this transaction",
      );
    }

    const category = await this.getCategory(categoryTitle);

    const transaction = transactionsRepository.create({
      title,
      category,
      type,
      value,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }

  private async getCategory(title: string): Promise<Category> {
    const categoriesRepository = getRepository(Category);

    const category = await categoriesRepository.findOne({
      where: { title },
    });

    if (category) {
      return category;
    }

    const newCategory = categoriesRepository.create({ title });

    await categoriesRepository.save(newCategory);

    return newCategory;
  }
}

export default CreateTransactionService;
